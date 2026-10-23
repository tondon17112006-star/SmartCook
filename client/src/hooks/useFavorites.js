import { useContext } from 'react'
import { FavoriteContext } from '../context/FavoriteContext.js'

export default function useFavorites() {
  const favorites = useContext(FavoriteContext)
  if (!favorites) throw new Error('useFavorites cần được sử dụng bên trong FavoriteProvider.')
  return favorites
}

export { useFavorites }
