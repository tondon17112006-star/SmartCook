import { api } from './api.js'

export async function fetchHealth(signal) {
  const { data } = await api.get('/health', { signal })

  if (
    data?.status !== 'ok' ||
    data?.service !== 'SmartCook API' ||
    typeof data?.timestamp !== 'string' ||
    Number.isNaN(Date.parse(data.timestamp))
  ) {
    throw new Error('Phản hồi kiểm tra kết nối không hợp lệ.')
  }

  return data
}
