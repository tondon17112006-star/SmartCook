import { useCallback, useEffect, useState } from 'react'

// Supply a memoized loader. Deferred starts also avoid duplicate StrictMode I/O.
export default function useAdminData(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setState({ data: null, loading: true, error: null })
      try {
        const data = await loader({ signal: controller.signal })
        if (active && !controller.signal.aborted) setState({ data, loading: false, error: null })
      } catch (error) {
        if (active && !controller.signal.aborted) setState({ data: null, loading: false, error })
      }
    })
    return () => { active = false; controller.abort() }
  }, [loader, attempt])
  return { ...state, reload }
}
