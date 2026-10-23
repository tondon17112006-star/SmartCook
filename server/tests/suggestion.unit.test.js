import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSuggestionBody } from '../src/utilities/suggestion-validator.js';
import {
  buildSuggestion,
  compareSuggestions,
  scoreRequiredIngredients,
} from '../src/services/suggestion-matcher.js';

const isBadRequest = (error) => error.status === 400 && typeof error.message === 'string';
const isInternalError = (error) => error.status === 500;
const recipe = {
  recipeId: 11, recipeName: 'Món kiểm thử', imageUrl: null, description: 'Công thức kiểm thử',
  prepTime: 10, cookTime: 15, servings: 2, difficulty: 'Dễ', categoryName: 'Món chính',
};
const ingredientRows = [
  { ingredientId: 1, ingredientName: 'Nguyên liệu A', quantity: 200, unit: 'g', isRequired: true, notes: 'Sơ chế' },
  { ingredientId: 2, ingredientName: 'Nguyên liệu B', quantity: 1.5, unit: 'quả', isRequired: true, notes: null },
  { ingredientId: 3, ingredientName: 'Gia vị C', quantity: 0.5, unit: 'muỗng', isRequired: false },
  { ingredientId: 4, ingredientName: 'Gia vị D', quantity: 1, unit: 'muỗng', isRequired: false },
];

test('suggestion validation requires a plain JSON object and known fields', () => {
  for (const body of [undefined, null, [], [1], 1, 'body', true, new Date(), new Map()]) {
    assert.throws(() => validateSuggestionBody(body), isBadRequest);
  }
  for (const field of ['includeAll', 'sort', 'ingredientId', '__proto__']) {
    const body = JSON.parse(`{"ingredientIds":[1],"${field}":true}`);
    assert.throws(() => validateSuggestionBody(body), isBadRequest);
  }
});

test('suggestion validation rejects missing, empty or non-array ingredient IDs', () => {
  for (const ingredientIds of [undefined, null, [], 1, '1', {}, true]) {
    assert.throws(() => validateSuggestionBody({ ingredientIds }), isBadRequest);
  }
});

test('suggestion IDs must be strict positive JSON integers within SQL INT', () => {
  for (const id of [0, -1, 1.5, '1', true, false, null, undefined, {}, [], NaN, Infinity, 2_147_483_648]) {
    assert.throws(() => validateSuggestionBody({ ingredientIds: [id] }), isBadRequest);
  }
  assert.throws(() => validateSuggestionBody({ ingredientIds: Array(1) }), isBadRequest);
  assert.deepEqual(validateSuggestionBody({ ingredientIds: [2_147_483_647] }).ingredientIds, [2_147_483_647]);
});

test('suggestion IDs are deduplicated stably without mutating caller input', () => {
  const body = { ingredientIds: [4, 2, 4, 1, 2] };
  const actual = validateSuggestionBody(body);
  assert.deepEqual(actual, { ingredientIds: [4, 2, 1], servings: null, page: 1, limit: 12, offset: 0 });
  assert.deepEqual(body.ingredientIds, [4, 2, 4, 1, 2]);
});

test('raw ingredient input is capped at 100 before deduplication', () => {
  assert.equal(validateSuggestionBody({ ingredientIds: Array(100).fill(1) }).ingredientIds.length, 1);
  assert.throws(() => validateSuggestionBody({ ingredientIds: Array(101).fill(1) }), isBadRequest);
  assert.equal(validateSuggestionBody({ ingredientIds: Array.from({ length: 100 }, (_, index) => index + 1) }).ingredientIds.length, 100);
});

test('servings only accepts strict JSON integers 1 through 20 or omission', () => {
  assert.equal(validateSuggestionBody({ ingredientIds: [1] }).servings, null);
  for (const servings of [1, 20]) {
    assert.equal(validateSuggestionBody({ ingredientIds: [1], servings }).servings, servings);
  }
  for (const servings of [null, '2', 0, -1, 1.5, 21, true, [], {}, NaN, Infinity]) {
    assert.throws(() => validateSuggestionBody({ ingredientIds: [1], servings }), isBadRequest);
  }
});

test('suggestion pagination applies defaults and bounds safe offsets', () => {
  assert.deepEqual(validateSuggestionBody({ ingredientIds: [1], page: 100_000, limit: 50 }), {
    ingredientIds: [1], servings: null, page: 100_000, limit: 50, offset: 4_999_950,
  });
  assert.equal(validateSuggestionBody({ ingredientIds: [1], page: 1, limit: 1 }).offset, 0);
  for (const page of [0, -1, 1.5, '1', null, true, [], {}, 100_001, NaN, Infinity]) {
    assert.throws(() => validateSuggestionBody({ ingredientIds: [1], page }), isBadRequest);
  }
  for (const limit of [0, -1, 1.5, '1', null, true, [], {}, 51, NaN, Infinity]) {
    assert.throws(() => validateSuggestionBody({ ingredientIds: [1], limit }), isBadRequest);
  }
});

test('SQL injection payloads are rejected rather than coerced into IDs or pagination', () => {
  const injection = "1); DROP TABLE dbo.Ingredients;--";
  for (const body of [
    { ingredientIds: [injection] },
    { ingredientIds: injection },
    { ingredientIds: [1], page: injection },
    { ingredientIds: [1], limit: injection },
    { ingredientIds: [1], servings: injection },
  ]) assert.throws(() => validateSuggestionBody(body), isBadRequest);
});

test('one matching required ingredient yields ready and 100 percent', () => {
  assert.deepEqual(scoreRequiredIngredients([1], [1]), {
    matchedRequiredCount: 1, totalRequiredCount: 1, missingRequiredCount: 0,
    matchPercentage: 100, status: 'ready', eligible: true,
  });
});

test('multiple available ingredients yield ready while irrelevant IDs do not affect the score', () => {
  assert.deepEqual(scoreRequiredIngredients([1, 2], [1, 2, 3, 4]), {
    matchedRequiredCount: 2, totalRequiredCount: 2, missingRequiredCount: 0,
    matchPercentage: 100, status: 'ready', eligible: true,
  });
});

test('one of two required ingredients yields 50 percent and missing', () => {
  assert.deepEqual(scoreRequiredIngredients([1, 2], [1, 3]), {
    matchedRequiredCount: 1, totalRequiredCount: 2, missingRequiredCount: 1,
    matchPercentage: 50, status: 'missing', eligible: true,
  });
});

test('required and available duplicates never inflate matches or counts', () => {
  assert.deepEqual(scoreRequiredIngredients([1, 1, '2'], ['1', 1, 1]), {
    matchedRequiredCount: 1, totalRequiredCount: 2, missingRequiredCount: 1,
    matchPercentage: 50, status: 'missing', eligible: true,
  });
});

test('scores round to the nearest integer and do not round an incomplete recipe to ready', () => {
  assert.equal(scoreRequiredIngredients([1, 2, 3], [1]).matchPercentage, 33);
  assert.equal(scoreRequiredIngredients([1, 2, 3], [1, 2]).matchPercentage, 67);
  const halfBoundaryIds = Array.from({ length: 200 }, (_, index) => index + 1);
  assert.equal(scoreRequiredIngredients(halfBoundaryIds, halfBoundaryIds.slice(0, 29)).matchPercentage, 15);
  const manyIds = Array.from({ length: 201 }, (_, index) => index + 1);
  const almostReady = scoreRequiredIngredients(manyIds, manyIds.slice(1));
  assert.equal(almostReady.matchPercentage, 100);
  assert.equal(almostReady.status, 'missing');
  assert.equal(almostReady.missingRequiredCount, 1);
});

test('a positive required match remains eligible even when its percentage rounds to zero', () => {
  const requiredIds = Array.from({ length: 1_000 }, (_, index) => index + 1);
  const score = scoreRequiredIngredients(requiredIds, [1]);
  assert.equal(score.matchPercentage, 0);
  assert.equal(score.eligible, true);
  assert.equal(score.status, 'missing');
  assert.equal(score.matchedRequiredCount, 1);
  assert.equal(score.missingRequiredCount, 999);
});

test('zero required matches are ineligible even when other ingredients are available', () => {
  assert.deepEqual(scoreRequiredIngredients([1, 2], [3, 4]), {
    matchedRequiredCount: 0, totalRequiredCount: 2, missingRequiredCount: 2,
    matchPercentage: 0, status: 'missing', eligible: false,
  });
  assert.equal(buildSuggestion(recipe, ingredientRows, [3, 4]), null);
});

test('zero required ingredients are excluded without dividing by zero or inventing 100 percent', () => {
  assert.deepEqual(scoreRequiredIngredients([], [3]), {
    matchedRequiredCount: 0, totalRequiredCount: 0, missingRequiredCount: 0,
    matchPercentage: 0, status: null, eligible: false,
  });
  assert.equal(buildSuggestion(recipe, ingredientRows.filter((row) => !row.isRequired), [3]), null);
  assert.equal(buildSuggestion(recipe, [], [1]), null);
});

test('ranking prioritizes rounded percentage before missing count, time or ID', () => {
  const high = { recipeId: 9, matchPercentage: 67, missingRequiredCount: 4, totalTime: 100 };
  const low = { recipeId: 1, matchPercentage: 50, missingRequiredCount: 1, totalTime: 10 };
  assert.ok(compareSuggestions(high, low) < 0);
  assert.ok(compareSuggestions(low, high) > 0);
});

test('equal rounded percentages rank by fewer missing required ingredients', () => {
  const fewer = { recipeId: 9, matchPercentage: 50, missingRequiredCount: 1, totalTime: 100 };
  const more = { recipeId: 1, matchPercentage: 50, missingRequiredCount: 2, totalTime: 10 };
  assert.ok(compareSuggestions(fewer, more) < 0);
});

test('equal score and missing count rank by shorter total time', () => {
  const shorter = { recipeId: 9, matchPercentage: 50, missingRequiredCount: 1, totalTime: 10 };
  const longer = { recipeId: 1, matchPercentage: 50, missingRequiredCount: 1, totalTime: 20 };
  assert.ok(compareSuggestions(shorter, longer) < 0);
});

test('all remaining ties use numeric recipe ID for deterministic order', () => {
  const ids = [10, 2, 1].map((recipeId) => ({ recipeId, matchPercentage: 50, missingRequiredCount: 1, totalTime: 20 }));
  assert.deepEqual(ids.sort(compareSuggestions).map((row) => row.recipeId), [1, 2, 10]);
  assert.equal(compareSuggestions(ids[0], { ...ids[0] }), 0);
});

test('suggestion separates present required, missing required and all optional ingredients', () => {
  const result = buildSuggestion(recipe, ingredientRows, [1, 3]);
  assert.equal(result.matchPercentage, 50);
  assert.equal(result.status, 'missing');
  assert.equal(result.totalRequiredCount, 2);
  assert.deepEqual(result.matchedIngredients.map((row) => row.ingredientId), [1]);
  assert.deepEqual(result.missingIngredients.map((row) => row.ingredientId), [2]);
  assert.deepEqual(result.optionalIngredients.map((row) => row.ingredientId), [3, 4]);
  assert.deepEqual(result.optionalIngredients.map((row) => row.isAvailable), [true, false]);
  assert.equal(result.matchedIngredients[0].isRequired, true);
  assert.equal(result.missingIngredients[0].isAvailable, false);
  assert.equal(result.optionalIngredients[0].notes, null);
  assert.equal('eligible' in result, false);
});

test('optional ingredient availability does not affect required percentage or ready status', () => {
  const withOptional = buildSuggestion(recipe, ingredientRows, [1, 2, 3, 4]);
  const withoutOptional = buildSuggestion(recipe, ingredientRows, [1, 2]);
  assert.equal(withoutOptional.matchPercentage, 100);
  assert.equal(withoutOptional.status, 'ready');
  assert.equal(withOptional.matchPercentage, withoutOptional.matchPercentage);
  assert.equal(withOptional.status, withoutOptional.status);
  assert.deepEqual(withoutOptional.optionalIngredients.map((row) => row.isAvailable), [false, false]);
});

test('omitted servings preserve original quantities and explicitly return requestedServings null', () => {
  const result = buildSuggestion(recipe, ingredientRows, [1]);
  assert.equal(result.requestedServings, null);
  assert.equal(result.servings, 2);
  assert.equal(result.matchedIngredients[0].quantity, 200);
  assert.equal(result.matchedIngredients[0].adjustedQuantity, 200);
  assert.equal(result.matchedIngredients[0].notes, 'Sơ chế');
});

test('changing servings scales all ingredient groups while retaining original quantities and units', () => {
  const snapshot = structuredClone({ recipe, ingredientRows });
  const result = buildSuggestion(recipe, ingredientRows, [1, 3], 3);
  assert.equal(result.requestedServings, 3);
  assert.equal(result.servings, 2);
  assert.equal(result.matchedIngredients[0].quantity, 200);
  assert.equal(result.matchedIngredients[0].adjustedQuantity, 300);
  assert.equal(result.missingIngredients[0].quantity, 1.5);
  assert.equal(result.missingIngredients[0].adjustedQuantity, 2.25);
  assert.equal(result.optionalIngredients[0].adjustedQuantity, 0.75);
  assert.equal(result.matchedIngredients[0].unit, 'g');
  assert.deepEqual({ recipe, ingredientRows }, snapshot);
});

test('fractional scaling removes floating artifacts while preserving tiny positive amounts', () => {
  const fractional = buildSuggestion({ ...recipe, servings: 3 }, [{ ...ingredientRows[0], quantity: 1 }], [1], 1);
  assert.equal(fractional.matchedIngredients[0].adjustedQuantity, 0.333333333333);
  const tiny = buildSuggestion({ ...recipe, servings: 2_147_483_647 }, [{ ...ingredientRows[0], quantity: 0.01 }], [1], 1);
  assert.ok(tiny.matchedIngredients[0].adjustedQuantity > 0);
  assert.ok(Number.isFinite(tiny.matchedIngredients[0].adjustedQuantity));
  const large = buildSuggestion({ ...recipe, servings: 1 }, [{ ...ingredientRows[0], quantity: 9_999_999_999.99 }], [1], 20);
  assert.ok(Number.isFinite(large.matchedIngredients[0].adjustedQuantity));
  assert.equal(large.matchedIngredients[0].quantity, 9_999_999_999.99);
});

test('invalid base servings fail safely rather than producing null, NaN or Infinity quantities', () => {
  for (const servings of [0, -1, 1.5, null, undefined, '', NaN, Infinity, 'invalid', 2_147_483_648]) {
    assert.throws(() => buildSuggestion({ ...recipe, servings }, ingredientRows, [1], 2), isInternalError);
    assert.throws(() => buildSuggestion({ ...recipe, servings }, ingredientRows, [1]), isInternalError);
  }
});

test('invalid original quantities or requested servings fail before an unsafe result is returned', () => {
  for (const quantity of [0, -1, null, undefined, NaN, Infinity, 'invalid']) {
    assert.throws(() => buildSuggestion(recipe, [{ ...ingredientRows[0], quantity }], [1], 2), isInternalError);
  }
  assert.throws(() => buildSuggestion({ ...recipe, servings: 1 }, [{ ...ingredientRows[0], quantity: Number.MAX_VALUE }], [1], 20), isInternalError);
  for (const servings of [0, -1, '2', 1.5, 21, NaN, Infinity, true]) {
    assert.throws(() => buildSuggestion(recipe, ingredientRows, [1], servings), isInternalError);
  }
});

test('native SQL numeric strings and BIT encodings produce JSON numbers and booleans', () => {
  const nativeRecipe = { ...recipe, recipeId: '11', prepTime: '10', cookTime: '15', servings: '2' };
  const nativeRows = ingredientRows.map((row) => ({
    ...row, ingredientId: String(row.ingredientId), quantity: String(row.quantity),
    isRequired: row.isRequired ? '1' : '0',
  }));
  const result = buildSuggestion(nativeRecipe, nativeRows, new Set([1, 3]), 2);
  assert.equal(result.recipeId, 11);
  assert.equal(result.totalTime, 25);
  assert.equal(result.servings, 2);
  assert.equal(result.matchedIngredients[0].quantity, 200);
  assert.equal(result.optionalIngredients[0].isRequired, false);
  assert.equal(result.optionalIngredients[0].isAvailable, true);
  assert.equal(result.matchPercentage, 50);
  assert.throws(() => buildSuggestion(recipe, [{ ...ingredientRows[0], isRequired: 'false' }], [1]), isInternalError);
});
