import useHealthCheck from '../hooks/useHealthCheck.js'
import { ApiHealthContext } from './ApiHealthContext.js'

export default function ApiHealthProvider({ children }) {
  const health = useHealthCheck()

  return (
    <ApiHealthContext.Provider value={health}>
      {children}
    </ApiHealthContext.Provider>
  )
}
