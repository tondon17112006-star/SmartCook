import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PantryContext } from './PantryContext.js'
import { loadIngredientCatalog } from '../services/ingredientService.js'
import {
  ingredientGroups,
  isIngredientId,
  isServings,
  MAX_PANTRY_INGREDIENTS,
  readPantryStorage,
  reconcilePantry,
  STORAGE_NOTICE,
  togglePantryIngredient,
  writePantryStorage,
} from '../utilities/pantryState.js'

function resolveStorage(providedStorage) {
  if (providedStorage !== undefined) return { storage: providedStorage, notice: null }
  if (typeof window === 'undefined') return { storage: null, notice: null }
  try {
    const storage = window.sessionStorage
    return { storage, notice: storage ? null : STORAGE_NOTICE }
  } catch {
    return { storage: null, notice: STORAGE_NOTICE }
  }
}

export default function PantryProvider({ children, loadCatalog = loadIngredientCatalog, storage }) {
  const [storageHandle] = useState(() => resolveStorage(storage))
  const [attempt, setAttempt] = useState(0)
  const requestToken = useMemo(() => ({ attempt, loadCatalog }), [attempt, loadCatalog])
  const requestGeneration = useRef(0)
  // Restore synchronously once. The first persistence effect must never replace
  // saved IDs with defaults before hydration has finished.
  const [state, setState] = useState(() => {
    const restored = readPantryStorage(storageHandle.storage)
    return {
      ...restored.pantry,
      catalog: [],
      token: requestToken,
      loading: true,
      error: null,
      selectionNotice: storageHandle.notice || restored.notice,
    }
  })

  useEffect(() => {
    const controller = new AbortController()
    const generation = ++requestGeneration.current
    let active = true
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return undefined
        return loadCatalog(controller.signal)
      })
      .then((catalog) => {
        if (!active || controller.signal.aborted || generation !== requestGeneration.current) return
        setState((current) => {
          if (!active || controller.signal.aborted || generation !== requestGeneration.current) return current
          // Reconcile the latest user selection, even if it changed while the
          // request was in flight. Failed requests never discard saved IDs.
          const reconciled = reconcilePantry(current, catalog)
          return {
            ...current,
            ...reconciled.pantry,
            catalog,
            token: requestToken,
            loading: false,
            error: null,
            selectionNotice: reconciled.notice || current.selectionNotice,
          }
        })
      })
      .catch((error) => {
        if (active && !controller.signal.aborted && generation === requestGeneration.current) {
          setState((current) => !active || controller.signal.aborted || generation !== requestGeneration.current
            ? current
            : { ...current, token: requestToken, loading: false, error })
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [loadCatalog, requestToken])

  const persistedPantry = useMemo(() => ({ ingredientIds: state.ingredientIds, servings: state.servings }), [state.ingredientIds, state.servings])
  useEffect(() => {
    const notice = writePantryStorage(storageHandle.storage, persistedPantry)
    if (notice) {
      // This update reports an external storage failure; it does not derive
      // application state from another state value.
      // oxlint-disable-next-line react/set-state-in-effect
      setState((current) => current.selectionNotice?.includes(notice)
        ? current
        : { ...current, selectionNotice: [current.selectionNotice, notice].filter(Boolean).join(' ') })
    }
  }, [persistedPantry, storageHandle])

  const retry = useCallback(() => {
    // Invalidate synchronously in the event, before effect cleanup. A response
    // from an earlier attempt must not reconcile IDs during the retry render.
    requestGeneration.current += 1
    setAttempt((value) => value + 1)
  }, [])
  const dismissNotice = useCallback(() => setState((current) => ({ ...current, selectionNotice: null })), [])
  const toggleIngredient = useCallback((id) => {
    setState((current) => {
      const availableIds = new Set(current.catalog.map((ingredient) => ingredient.ingredientId))
      if (!current.ingredientIds.includes(id) && availableIds.has(id)
        && current.ingredientIds.length >= MAX_PANTRY_INGREDIENTS) {
        return { ...current, selectionNotice: 'Bạn có thể chọn tối đa 100 loại nguyên liệu cho mỗi lần tìm món.' }
      }
      const next = togglePantryIngredient(current, id, availableIds)
      return next === current ? current : { ...current, ingredientIds: next.ingredientIds }
    })
  }, [])
  const removeIngredient = useCallback((id) => {
    setState((current) => current.ingredientIds.includes(id)
      ? { ...current, ingredientIds: current.ingredientIds.filter((selectedId) => selectedId !== id) }
      : current)
  }, [])
  const clearSelection = useCallback(() => {
    setState((current) => current.ingredientIds.length ? { ...current, ingredientIds: [] } : current)
  }, [])
  const setServings = useCallback((servings) => {
    if (!isServings(servings)) return
    setState((current) => current.servings === servings ? current : { ...current, servings })
  }, [])
  const replaceSelection = useCallback((ids) => {
    if (state.loading || state.token !== requestToken || state.error
      || !Array.isArray(ids) || ids.length < 1 || ids.length > MAX_PANTRY_INGREDIENTS
      || !ids.every(isIngredientId) || new Set(ids).size !== ids.length) return false
    const known = new Set(state.catalog.map((item) => item.ingredientId))
    if (!ids.every((id) => known.has(id))) return false
    // Import only ingredient types. Keep the servings selected in this flow.
    setState((current) => ({ ...current, ingredientIds: [...ids], selectionNotice: null }))
    return true
  }, [state.catalog, state.error, state.loading, state.token, requestToken])

  const groups = useMemo(() => ingredientGroups(state.catalog), [state.catalog])
  const selectedIngredients = useMemo(() => {
    const byId = new Map(state.catalog.map((ingredient) => [ingredient.ingredientId, ingredient]))
    return state.ingredientIds.map((id) => byId.get(id)).filter(Boolean)
  }, [state.catalog, state.ingredientIds])
  const loading = state.token !== requestToken || state.loading
  const error = state.token === requestToken ? state.error : null
  const value = useMemo(() => ({
    catalog: state.catalog,
    groups,
    selectedIds: state.ingredientIds,
    selectedIngredients,
    servings: state.servings,
    toggleIngredient,
    removeIngredient,
    clearSelection,
    setServings,
    replaceSelection,
    loading,
    error,
    retry,
    selectionNotice: state.selectionNotice,
    dismissNotice,
    isReady: !loading && !error,
  }), [state, groups, selectedIngredients, toggleIngredient, removeIngredient, clearSelection, setServings, replaceSelection, loading, error, retry, dismissNotice])

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>
}
