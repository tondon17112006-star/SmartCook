import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthContext } from './AuthContext.js'
import { api } from '../services/api.js'
import { getCurrentUser, loginUser, logoutUser, registerUser, updateUserProfile } from '../services/authService.js'

function messageFor(error) {
  if (typeof error?.response?.data?.message === 'string') return error.response.data.message
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'Yêu cầu mất nhiều thời gian. Bạn vui lòng thử lại.'
  return 'Không thể kết nối đến máy chủ. Bạn kiểm tra kết nối và thử lại nhé.'
}

function isSessionRequest(config) {
  // Login 401 is a rejected credential attempt, not the expiry of another
  // session. Only endpoints requiring an existing account invalidate it.
  const path = config?.url || ''
  return /^\/(?:api\/)?auth\/(?:me|profile)(?:\?|$)/u.test(path)
    || /^\/(?:api\/)?admin(?:\/|\?|$)/u.test(path)
    || /^\/(?:api\/)?(?:favorites|pantry|reviews)(?:\/|\?|$)/u.test(path)
    || /^\/(?:api\/)?recipes\/[1-9]\d*\/reviews\/mine(?:\?|$)/u.test(path)
    || (config?.method?.toLowerCase() !== 'get' && /^\/(?:api\/)?recipes\/[1-9]\d*\/reviews(?:\?|$)/u.test(path))
}

export default function AuthProvider({ children }) {
  const [state, setState] = useState({ currentUser: null, sessionStatus: 'loading', error: null })
  const [sessionVersion, setSessionVersion] = useState(0)
  const generation = useRef(0)
  const mounted = useRef(false)
  const sessionRequest = useRef(null)

  const beginOperation = useCallback(() => {
    sessionRequest.current?.abort()
    sessionRequest.current = null
    generation.current += 1
    return generation.current
  }, [])

  const refreshSession = useCallback(async () => {
    const operation = beginOperation()
    const controller = new AbortController()
    sessionRequest.current = controller
    setState((current) => ({ ...current, sessionStatus: 'loading', error: null }))
    try {
      const user = await getCurrentUser({ signal: controller.signal, authGeneration: operation })
      if (mounted.current && generation.current === operation && !controller.signal.aborted) {
        setSessionVersion((value) => value + 1)
        setState({ currentUser: user, sessionStatus: 'authenticated', error: null })
      }
      return user
    } catch (error) {
      if (mounted.current && generation.current === operation && !controller.signal.aborted) {
        if (error?.response?.status === 401) setState({ currentUser: null, sessionStatus: 'guest', error: null })
        else setState((current) => ({ ...current, sessionStatus: 'unknown', error: messageFor(error) }))
      }
      return null
    }
  }, [beginOperation])

  useEffect(() => {
    let active = true
    mounted.current = true
    const requestInterceptor = api.interceptors.request.use((config) => {
      if (isSessionRequest(config) && config.smartCookAuthGeneration === undefined) {
        config.smartCookAuthGeneration = generation.current
      }
      return config
    })
    const responseInterceptor = api.interceptors.response.use((response) => response, (error) => {
      if (mounted.current && error?.response?.status === 401 && isSessionRequest(error.config)
        && error.config?.smartCookAuthGeneration === generation.current) {
        generation.current += 1
        setSessionVersion((value) => value + 1)
        setState({ currentUser: null, sessionStatus: 'guest', error: null })
      }
      return Promise.reject(error)
    })
    // Defer the external request so a StrictMode mount that is immediately
    // cleaned up never starts a second bootstrap request.
    void Promise.resolve().then(() => { if (active) return refreshSession(); return null })
    return () => {
      active = false
      mounted.current = false
      beginOperation()
      api.interceptors.request.eject(requestInterceptor)
      api.interceptors.response.eject(responseInterceptor)
    }
  }, [beginOperation, refreshSession])

  const login = useCallback(async (credentials) => {
    const operation = beginOperation()
    setState((current) => ({ ...current, sessionStatus: current.sessionStatus === 'loading' ? 'unknown' : current.sessionStatus, error: null }))
    try {
      const user = await loginUser(credentials, { authGeneration: operation })
      if (mounted.current && generation.current === operation) {
        setSessionVersion((value) => value + 1)
        setState({ currentUser: user, sessionStatus: 'authenticated', error: null })
      }
      return user
    } catch (error) {
      if (mounted.current && generation.current === operation) setState((current) => ({ ...current, error: messageFor(error) }))
      throw error
    }
  }, [beginOperation])

  const register = useCallback(async (credentials) => {
    const operation = generation.current
    try {
      // Registration deliberately does not establish a logged-in session.
      return await registerUser(credentials)
    } catch (error) {
      if (mounted.current && generation.current === operation) setState((current) => ({ ...current, error: messageFor(error) }))
      throw error
    }
  }, [])

  const logout = useCallback(async ({ onSuccess } = {}) => {
    const operation = beginOperation()
    setState((current) => ({ ...current, error: null }))
    try {
      await logoutUser({ authGeneration: operation })
      if (mounted.current && generation.current === operation) {
        // Callers may move away from a protected page after the server revokes
        // the cookie. Queue that navigation before guest state, so a guard's
        // login redirect cannot race the caller's intended destination.
        startTransition(() => {
          onSuccess?.()
          setSessionVersion((value) => value + 1)
          setState({ currentUser: null, sessionStatus: 'guest', error: null })
        })
      }
    } catch (error) {
      // A failed request cannot revoke or clear an HttpOnly cookie. Keep the
      // current account visible so the user can retry the actual server action.
      if (mounted.current && generation.current === operation) setState((current) => ({ ...current, error: messageFor(error) }))
      throw error
    }
  }, [beginOperation])

  const updateProfile = useCallback(async (profile) => {
    const operation = beginOperation()
    setState((current) => ({ ...current, error: null }))
    try {
      const user = await updateUserProfile(profile, { authGeneration: operation })
      if (mounted.current && generation.current === operation) setState({ currentUser: user, sessionStatus: 'authenticated', error: null })
      return user
    } catch (error) {
      if (mounted.current && generation.current === operation) setState((current) => ({ ...current, error: messageFor(error) }))
      throw error
    }
  }, [beginOperation])

  const value = useMemo(() => ({
    ...state,
    sessionGeneration: sessionVersion,
    isAuthenticated: state.sessionStatus === 'authenticated',
    isLoading: state.sessionStatus === 'loading',
    login, register, logout, refreshSession, updateProfile,
  }), [state, sessionVersion, login, register, logout, refreshSession, updateProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthProvider }
