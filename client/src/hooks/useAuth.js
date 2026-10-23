import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext.js'

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth cần được sử dụng bên trong AuthProvider.')
  return auth
}

export default useAuth
