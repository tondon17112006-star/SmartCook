function normalizeText(value) {
  return String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('vi')
}

// The provider loads the complete catalog before these local filters become available.
// Preserve accents and literal characters, matching the API's CI_AS substring behavior.
export function filterIngredients(catalog, { search = '', group = '' } = {}) {
  const keyword = normalizeText(search)
  const category = normalizeText(group)
  return catalog.filter((ingredient) => (
    (!keyword || normalizeText(ingredient.ingredientName).includes(keyword))
    && (!category || normalizeText(ingredient.ingredientCategory) === category)
  ))
}
