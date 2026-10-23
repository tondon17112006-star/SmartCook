import { api } from './api.js'
import { collectSuggestionPages, SUGGESTION_PAGE_SIZE, validateSuggestionPage } from '../utilities/suggestions.js'

export async function suggestRecipes({ ingredientIds, servings, page = 1, limit = SUGGESTION_PAGE_SIZE }, { signal } = {}) {
  const response = await api.post('/recipes/suggest', { ingredientIds, servings, page, limit }, { signal })
  return validateSuggestionPage(response.data, page, limit)
}

export async function getSuggestionPage(selection, page, { signal } = {}) {
  const response = await suggestRecipes({ ...selection, page }, { signal })
  const lastPage = Math.max(1, response.pagination.totalPages)
  if (page > lastPage) {
    return suggestRecipes({ ...selection, page: lastPage }, { signal })
  }
  return response
}

export async function getCompleteSuggestions(selection, { signal } = {}) {
  return collectSuggestionPages(
    (page, limit) => suggestRecipes({ ...selection, page, limit }, { signal }),
    { signal },
  )
}
