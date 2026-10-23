import { HttpError } from '../utilities/http-error.js';

function numericIdSet(ids) {
  return new Set(Array.from(ids, Number));
}

/** Only distinct required ingredient identities contribute to the percentage. */
export function scoreRequiredIngredients(requiredIds, availableIds) {
  const required = numericIdSet(requiredIds);
  const available = numericIdSet(availableIds);
  const totalRequiredCount = required.size;
  const matchedRequiredCount = [...required].filter((id) => available.has(id)).length;
  const missingRequiredCount = totalRequiredCount - matchedRequiredCount;
  const eligible = totalRequiredCount > 0 && matchedRequiredCount > 0;

  return {
    matchedRequiredCount,
    totalRequiredCount,
    missingRequiredCount,
    matchPercentage: totalRequiredCount === 0
      ? 0
      // Integer half-up arithmetic matches SQL exactly at boundaries such as
      // 29/200 (14.5%), where floating division can incorrectly round to 14.
      : Math.floor((200 * matchedRequiredCount + totalRequiredCount) / (2 * totalRequiredCount)),
    status: totalRequiredCount === 0
      ? null
      : missingRequiredCount === 0 ? 'ready' : 'missing',
    eligible,
  };
}

/** Rank by the rounded public score, then missing count, time and stable ID. */
export function compareSuggestions(left, right) {
  return right.matchPercentage - left.matchPercentage
    || left.missingRequiredCount - right.missingRequiredCount
    || left.totalTime - right.totalTime
    || left.recipeId - right.recipeId;
}

function invalidRecipeData() {
  return new HttpError(500, 'Không thể xử lý dữ liệu công thức.');
}

function requiredBit(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  throw invalidRecipeData();
}

/** Build one public suggestion; stock quantities are unknown to this API. */
export function buildSuggestion(recipe, ingredientRows, availableIds, requestedServings = null) {
  const available = numericIdSet(availableIds);
  const ingredients = ingredientRows.map((row) => ({
    ...row,
    ingredientId: Number(row.ingredientId),
    isRequired: requiredBit(row.isRequired),
  }));
  const { eligible, ...score } = scoreRequiredIngredients(
    ingredients.filter((row) => row.isRequired).map((row) => row.ingredientId),
    available,
  );
  if (!eligible) return null;

  const servings = Number(recipe.servings);
  if (!Number.isSafeInteger(servings) || servings < 1 || servings > 2_147_483_647
    || (requestedServings !== null && (
      typeof requestedServings !== 'number' || !Number.isInteger(requestedServings)
      || requestedServings < 1 || requestedServings > 20
    ))) {
    throw invalidRecipeData();
  }

  const mappedIngredients = ingredients.map((row) => {
    const quantity = Number(row.quantity);
    const scaled = requestedServings === null ? quantity : quantity * requestedServings / servings;
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(scaled) || scaled <= 0) {
      throw invalidRecipeData();
    }
    // Twelve significant digits remove floating artifacts without rounding tiny
    // positive quantities to zero; retain the original database quantity separately.
    const adjustedQuantity = requestedServings === null ? quantity : Number(scaled.toPrecision(12));
    return {
      ingredientId: row.ingredientId,
      ingredientName: row.ingredientName,
      quantity,
      adjustedQuantity,
      unit: row.unit,
      isRequired: row.isRequired,
      isAvailable: available.has(row.ingredientId),
      notes: row.notes ?? null,
    };
  });
  const prepTime = Number(recipe.prepTime);
  const cookTime = Number(recipe.cookTime);

  return {
    recipeId: Number(recipe.recipeId),
    recipeName: recipe.recipeName,
    imageUrl: recipe.imageUrl ?? null,
    description: recipe.description ?? null,
    prepTime,
    cookTime,
    totalTime: prepTime + cookTime,
    servings,
    requestedServings,
    difficulty: recipe.difficulty,
    categoryName: recipe.categoryName,
    ...score,
    matchedIngredients: mappedIngredients.filter((row) => row.isRequired && row.isAvailable),
    missingIngredients: mappedIngredients.filter((row) => row.isRequired && !row.isAvailable),
    optionalIngredients: mappedIngredients.filter((row) => !row.isRequired),
  };
}
