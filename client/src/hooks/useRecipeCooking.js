import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applySuggestedCookingServings,
  COOKING_STORAGE_NOTICE,
  getAdjustedCookingIngredients,
  getCookingScope,
  getCookingServings,
  isCookingServings,
  readCookingStorage,
  reconcileCookingProgress,
  resetCookingProgress,
  sortCookingSteps,
  toggleCookingProgressId,
  writeCookingStorage,
} from '../utilities/recipeCooking.js'

function resolveStorage() {
  if (typeof window === 'undefined') return { storage: null, notice: null }
  try {
    const storage = window.sessionStorage
    return { storage, notice: storage ? null : COOKING_STORAGE_NOTICE }
  } catch {
    return { storage: null, notice: COOKING_STORAGE_NOTICE }
  }
}

function joinNotices(...notices) {
  return [...new Set(notices.filter(Boolean))].join(' ') || null
}

export default function useRecipeCooking(recipe, { suggestedServings, entryKey } = {}) {
  const [storageHandle] = useState(resolveStorage)
  const options = { suggestedServings, entryKey }
  const scope = getCookingScope(recipe, options)
  const [record, setRecord] = useState(() => {
    const restored = readCookingStorage(storageHandle.storage, recipe, options)
    return { ...restored, notice: joinNotices(storageHandle.notice, restored.notice), scope }
  })

  // A route can reuse this component for another recipe. Adjust before commit,
  // so an effect can never write the old recipe's progress under a new key.
  let current = record
  if (record.scope !== scope) {
    const sameRecipe = record.progress.recipeId === recipe?.recipeId
    const restored = sameRecipe
      ? reconcileCookingProgress(record.progress, recipe)
      : readCookingStorage(storageHandle.storage, recipe, options)
    current = {
      ...restored,
      progress: applySuggestedCookingServings(restored.progress, recipe, options),
      notice: joinNotices(sameRecipe ? record.notice : storageHandle.notice, restored.notice),
      scope,
    }
    setRecord(current)
  }

  useEffect(() => {
    // Only the state committed for this exact recipe/navigation may persist.
    if (current.scope !== scope) return
    const notice = writeCookingStorage(storageHandle.storage, current.progress)
    if (notice) {
      // Reports an external storage failure; no derived application state.
      // oxlint-disable-next-line react/set-state-in-effect
      setRecord((latest) => latest.scope !== scope || latest.notice?.includes(notice)
        ? latest : { ...latest, notice: joinNotices(latest.notice, notice) })
    }
  }, [current.progress, current.scope, scope, storageHandle])

  const updateProgress = useCallback((update) => {
    setRecord((latest) => {
      if (latest.scope !== scope) return latest
      const progress = update(latest.progress)
      return progress === latest.progress ? latest : { ...latest, progress }
    })
  }, [scope])

  const toggleIngredient = useCallback((id) => updateProgress((progress) => toggleCookingProgressId(progress, recipe, 'preparedIds', id)), [recipe, updateProgress])
  const toggleStep = useCallback((id) => updateProgress((progress) => toggleCookingProgressId(progress, recipe, 'completedIds', id)), [recipe, updateProgress])
  const setCurrentStep = useCallback((id) => {
    if (!sortCookingSteps(recipe?.steps).some((step) => step.stepId === id)) return
    updateProgress((progress) => progress.currentStepId === id ? progress : { ...progress, currentStepId: id })
  }, [recipe, updateProgress])
  const setServings = useCallback((servings) => {
    if (!getCookingServings(recipe).canScale || !isCookingServings(servings)) return
    updateProgress((progress) => progress.servings === servings ? progress : { ...progress, servings })
  }, [recipe, updateProgress])
  const reset = useCallback(() => updateProgress((progress) => resetCookingProgress(progress, recipe)), [recipe, updateProgress])
  const dismissNotice = useCallback(() => setRecord((latest) => ({ ...latest, notice: null })), [])
  const ingredients = useMemo(() => getAdjustedCookingIngredients(recipe, current.progress.servings), [recipe, current.progress.servings])
  const steps = useMemo(() => sortCookingSteps(recipe?.steps), [recipe])
  const completedCount = current.progress.completedIds.length
  const servingsInfo = getCookingServings(recipe)

  return {
    servings: current.progress.servings,
    canScale: servingsInfo.canScale,
    scalingNotice: servingsInfo.scalingNotice,
    ingredients,
    steps,
    preparedIds: current.progress.preparedIds,
    completedIds: current.progress.completedIds,
    currentStepId: current.progress.currentStepId,
    preparedCount: current.progress.preparedIds.length,
    completedCount,
    percentage: steps.length ? Math.round(completedCount / steps.length * 100) : 0,
    allComplete: steps.length > 0 && completedCount === steps.length,
    toggleIngredient,
    toggleStep,
    setCurrentStep,
    setServings,
    reset,
    notice: current.notice,
    dismissNotice,
  }
}
