import { useContext } from 'react'
import { ApiHealthContext } from '../context/ApiHealthContext.js'

export default function useApiHealth() {
  const context = useContext(ApiHealthContext)
  if (!context) {
    throw new Error('useApiHealth phải được dùng trong ApiHealthProvider.')
  }
  return context
}
