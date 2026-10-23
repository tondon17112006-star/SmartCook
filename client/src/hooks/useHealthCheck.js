import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchHealth } from '../services/healthService.js'

export default function useHealthCheck() {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const requestRef = useRef(null)

  const requestHealth = useCallback(() => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller

    return fetchHealth(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ status: 'success', data, error: '' })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            data: null,
            error: error.message === 'Phản hồi kiểm tra kết nối không hợp lệ.'
              ? error.message
              : 'Chưa kết nối được máy chủ. Hãy chạy Backend rồi kiểm tra lại.',
          })
        }
      })
  }, [])

  const checkHealth = () => {
    setState({ status: 'loading', data: null, error: '' })
    return requestHealth()
  }

  useEffect(() => {
    void requestHealth()
    return () => requestRef.current?.abort()
  }, [requestHealth])

  return { ...state, checkHealth }
}
