import { useEffect, useRef, useState } from 'react'

export function adminMessage(error) {
  return error?.response?.data?.message || 'Chưa thể lưu thay đổi. Bạn vui lòng thử lại.'
}
export default function useAdminMutation() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const mounted = useRef(false), busy = useRef(false), request = useRef(null)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; request.current?.abort() }
  }, [])
  async function run(action, onSuccess) {
    if (busy.current) return false
    busy.current = true
    const controller = new AbortController()
    request.current = controller
    setPending(true); setError(null)
    try {
      const result = await action({ signal: controller.signal })
      if (!mounted.current || controller.signal.aborted) return false
      onSuccess?.(result)
      return true
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) setError(adminMessage(failure))
      return false
    } finally {
      busy.current = false
      if (mounted.current && !controller.signal.aborted) setPending(false)
    }
  }
  return { run, pending, error, reset: () => setError(null) }
}
