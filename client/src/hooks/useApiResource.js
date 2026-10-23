import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * loader(signal) returns the complete API response body. Declare the values
 * used by the loader in deps (with a constant number of entries); an inline
 * loader must not restart every render.
 * Each effect captures the loader for its dependency values. Retry starts a
 * new effect and captures the current loader as well.
 */
export function useApiResource(loader, deps = []) {
  const [attempt, setAttempt] = useState(0)
  // A caller-owned dependency list is the public contract of this hook.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const requestToken = useMemo(() => ({}), [attempt, ...deps])
  const [state, setState] = useState({ token: requestToken, data: null, loading: true, error: null })
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return undefined
        return loader(controller.signal)
      })
      .then((data) => {
        if (active) setState({ token: requestToken, data, loading: false, error: null })
      })
      .catch((error) => {
        if (active && !controller.signal.aborted) {
          setState({ token: requestToken, data: null, loading: false, error })
        }
      })

    return () => {
      active = false
      controller.abort()
    }
    // requestToken tracks deps and retry. The inline loader is deliberately
    // excluded; changing its identity alone must not start another request.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [requestToken])

  // Invalidate during render, before the new effect runs. Even if an earlier
  // response resolves before effect cleanup, its token cannot reveal old data.
  if (state.token !== requestToken) return { data: null, loading: true, error: null, retry }
  return { data: state.data, loading: state.loading, error: state.error, retry }
}

export default useApiResource
