import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useAuth from '../hooks/useAuth.js'
import { addFavorite, getFavoriteIds, removeFavorite } from '../services/favoriteService.js'
import { FavoriteContext } from './FavoriteContext.js'

function emptyState(key) {
  return { key, ids: new Set(), pendingIds: new Set(), isReady: false, isLoading: false, error: null, revision: 0 }
}

export default function FavoriteProvider({ children }) {
  const { currentUser, isAuthenticated, sessionGeneration = 0 } = useAuth()
  const key = isAuthenticated ? `${currentUser.userId}:${sessionGeneration}` : null
  const currentKey = useRef(key)
  const mounted = useRef(false)
  const idsRequest = useRef(null)
  const pending = useRef(new Set())
  const mutations = useRef(new Map())
  const refreshAfterMutation = useRef(false)
  const stateRef = useRef(null)
  const [state, setState] = useState(() => emptyState(key))
  // Commit the current account before asynchronous work resumes. Avoid exposing
  // an account from an abandoned concurrent render to a pending request.
  useLayoutEffect(() => { currentKey.current = key; stateRef.current = state }, [key, state])

  const reload = useCallback(async () => {
    const requestKey = currentKey.current
    if (!requestKey) return
    if (pending.current.size > 0) { refreshAfterMutation.current = true; return }
    idsRequest.current?.abort()
    const controller = new AbortController()
    idsRequest.current = controller
    setState((previous) => ({ ...(previous.key === requestKey ? previous : emptyState(requestKey)), isLoading: true, error: null }))
    try {
      const ids = await getFavoriteIds({ signal: controller.signal })
      if (mounted.current && currentKey.current === requestKey && !controller.signal.aborted) {
        setState((previous) => ({ ...previous, key: requestKey, ids: new Set(ids), isReady: true, isLoading: false, error: null, revision: previous.revision + (previous.isReady ? 1 : 0) }))
      }
    } catch (error) {
      if (mounted.current && currentKey.current === requestKey && !controller.signal.aborted) {
        setState((previous) => ({ ...previous, isReady: false, isLoading: false, error }))
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    mounted.current = true
    const activeMutations = mutations.current
    pending.current.clear()
    refreshAfterMutation.current = false
    // StrictMode's discarded mount must not duplicate the external request.
    void Promise.resolve().then(() => { if (active && key) return reload(); return null })
    return () => {
      active = false
      mounted.current = false
      idsRequest.current?.abort()
      for (const controller of activeMutations.values()) controller.abort()
      activeMutations.clear()
    }
  }, [key, reload])

  const toggleFavorite = useCallback(async (recipeId) => {
    const requestKey = currentKey.current
    const snapshot = stateRef.current
    if (!requestKey || snapshot.key !== requestKey || !snapshot.isReady || snapshot.isLoading) {
      throw new Error('Chưa tải được trạng thái yêu thích. Bạn vui lòng thử lại.')
    }
    const operationKey = `${requestKey}:${recipeId}`
    if (pending.current.has(operationKey)) return null
    pending.current.add(operationKey)
    const controller = new AbortController()
    mutations.current.set(operationKey, controller)
    const wasFavorite = snapshot.ids.has(recipeId)
    setState((previous) => ({ ...previous, pendingIds: new Set([...previous.pendingIds, recipeId]) }))
    try {
      if (wasFavorite) await removeFavorite(recipeId, { signal: controller.signal })
      else await addFavorite(recipeId, { signal: controller.signal })
      if (mounted.current && currentKey.current === requestKey) {
        setState((previous) => {
          const ids = new Set(previous.ids)
          if (wasFavorite) ids.delete(recipeId)
          else ids.add(recipeId)
          return { ...previous, ids, revision: previous.revision + 1 }
        })
        return !wasFavorite
      }
      return null
    } catch (error) {
      // Another browser tab may have changed the same favorite. Re-read truth
      // from the server while retaining the failed action's visible message.
      if (mounted.current && currentKey.current === requestKey && [404, 409].includes(error?.response?.status)) void reload()
      throw error
    } finally {
      pending.current.delete(operationKey)
      mutations.current.delete(operationKey)
      if (mounted.current && currentKey.current === requestKey) {
        setState((previous) => {
          const pendingIds = new Set(previous.pendingIds)
          pendingIds.delete(recipeId)
          return { ...previous, pendingIds }
        })
        if (pending.current.size === 0 && refreshAfterMutation.current) {
          refreshAfterMutation.current = false
          void reload()
        }
      }
    }
  }, [reload])

  // Account transitions hide the previous account's state in the same render,
  // before effect cleanup and before any old HTTP request can finish.
  const visible = state.key === key ? state : emptyState(key)
  const value = useMemo(() => ({
    ...visible,
    reload,
    toggleFavorite,
    isFavorite: (recipeId) => visible.ids.has(recipeId),
  }), [visible, reload, toggleFavorite])

  return <FavoriteContext.Provider value={value}>{children}</FavoriteContext.Provider>
}
