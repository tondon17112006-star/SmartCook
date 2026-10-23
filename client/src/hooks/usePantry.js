import { useContext } from 'react'
import { PantryContext } from '../context/PantryContext.js'

export function usePantry() {
  const context = useContext(PantryContext)
  if (!context) throw new Error('usePantry cần được sử dụng bên trong PantryProvider.')
  return context
}

export default usePantry
