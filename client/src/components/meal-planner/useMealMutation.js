import { useEffect, useRef, useState } from 'react'
import { mealError } from '../../utilities/mealPlannerDates.js'

// Parent pages/dialogs are keyed by user + sessionGeneration. Unmount cancels
// both CSRF acquisition and the subsequent write, and discards stale feedback.
export default function useMealMutation() {
  const [pending, setPending] = useState(false), [error, setError] = useState(null)
  const alive = useRef(false), busy = useRef(false), controller = useRef(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort() } }, [])
  async function run(action, onSuccess) {
    if (busy.current) return
    busy.current = true; setPending(true); setError(null)
    const request = new AbortController(); controller.current = request
    try {
      const result = await action({ signal: request.signal })
      if (alive.current && !request.signal.aborted) onSuccess(result)
    } catch (failure) {
      if (alive.current && !request.signal.aborted) setError(mealError(failure))
    } finally {
      busy.current = false
      if (alive.current && !request.signal.aborted) setPending(false)
    }
  }
  return { pending, error, setError, run }
}
