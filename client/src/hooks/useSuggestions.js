import useApiResource from './useApiResource.js'
import { getCompleteSuggestions, getSuggestionPage } from '../services/suggestionService.js'
import { filterSuggestionCollection } from '../utilities/suggestions.js'

export default function useSuggestions({ ingredientIds, servings, page = 1, status = 'all' }) {
  // Selection order does not affect matching. Stable IDs avoid duplicate requests.
  const selectionKey = JSON.stringify({ ingredientIds: [...new Set(ingredientIds)].sort((a, b) => a - b), servings })
  const filtered = status !== 'all'
  const serverPage = filtered ? 1 : page
  const resource = useApiResource((signal) => {
    const selection = JSON.parse(selectionKey)
    if (!selection.ingredientIds.length) return null
    return filtered
      ? getCompleteSuggestions(selection, { signal })
      : getSuggestionPage(selection, serverPage, { signal })
  }, [selectionKey, filtered, serverPage])

  // Changing ready/missing or a filtered page reuses the complete collection.
  const data = !resource.loading && !resource.error && resource.data && filtered
    ? filterSuggestionCollection(resource.data, status, page)
    : resource.data
  return { ...resource, data }
}
