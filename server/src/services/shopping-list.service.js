// SQL DECIMAL arrives as text: never pass through Number before portion arithmetic.
function gcd(a, b) { while (b) { const next = a % b; a = b; b = next; } return a; }
function decimalFraction(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/u.test(value)) throw new Error('Invalid SQL ingredient quantity.');
  const [whole, fraction = ''] = value.split('.');
  const numerator = BigInt(whole + fraction); const denominator = 10n ** BigInt(fraction.length);
  if (numerator <= 0n) throw new Error('Invalid SQL ingredient quantity.');
  return [numerator, denominator];
}
function positiveInteger(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid SQL recipe servings.');
  return BigInt(value);
}
function addFraction(target, numerator, denominator) {
  const common = gcd(target.denominator, denominator);
  const sum = target.numerator * (denominator / common) + numerator * (target.denominator / common);
  const divisor = target.denominator * (denominator / common);
  const reduce = gcd(sum, divisor);
  target.numerator = sum / reduce; target.denominator = divisor / reduce;
}
function ceilSix(numerator, denominator) {
  const scaled = (numerator * 1_000_000n + denominator - 1n) / denominator;
  const whole = scaled / 1_000_000n;
  const fraction = (scaled % 1_000_000n).toString().padStart(6, '0').replace(/0+$/u, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** Required-only totals, grouped by IngredientID and exact unit (no unit conversion or Pantry subtraction). */
export function aggregateShoppingList(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.isRequired) continue;
    const key = JSON.stringify([row.ingredientId, row.unit]);
    if (!groups.has(key)) groups.set(key, {
      ingredientId: row.ingredientId, ingredientName: row.ingredientName,
      ingredientCategory: row.ingredientCategory, unit: row.unit,
      numerator: 0n, denominator: 1n, recipes: new Map(), plannedItems: new Set(),
    });
    const group = groups.get(key);
    const [quantity, scale] = decimalFraction(row.quantity);
    addFraction(group, quantity * positiveInteger(row.servings), scale * positiveInteger(row.originalServings));
    group.recipes.set(row.recipeId, { recipeId: row.recipeId, recipeName: row.recipeName });
    group.plannedItems.add(row.mealPlanItemId);
  }
  return [...groups.values()].map((group) => ({
    ingredientId: group.ingredientId, ingredientName: group.ingredientName,
    ingredientCategory: group.ingredientCategory, unit: group.unit,
    totalQuantity: ceilSix(group.numerator, group.denominator),
    recipeCount: group.recipes.size, plannedItemCount: group.plannedItems.size,
    recipes: [...group.recipes.values()].sort((a, b) => a.recipeId - b.recipeId),
  })).sort((a, b) => a.ingredientName.localeCompare(b.ingredientName, 'vi') || a.ingredientId - b.ingredientId || a.unit.localeCompare(b.unit, 'vi'));
}
