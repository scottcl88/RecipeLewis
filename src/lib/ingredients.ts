import type { Ingredient } from './types';

const UNITS = ['cup','cups','tbsp','tablespoon','tablespoons','tsp','teaspoon','teaspoons','oz','ounce','ounces','lb','lbs','pound','pounds','g','kg','ml','l','pinch','dash','clove','cloves','can','cans','stick','sticks','slice','slices'];
const QTY = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])(?:\s*-\s*(?:\d+(?:\.\d+)?))?/;

/** Parse a pasted list (one ingredient per line) into rows: quantity / unit / name. */
export function parseIngredientList(text: string): Ingredient[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-*•\u2022]+/, '').trim())
    .filter(Boolean)
    .map((line) => {
      let rest = line;
      let quantity = '';
      const q = QTY.exec(rest);
      if (q) { quantity = q[0].trim(); rest = rest.slice(q[0].length).trim(); }
      let unit = '';
      const m = /^([A-Za-z]+)\.?\s+(.*)$/.exec(rest);
      if (quantity && m && UNITS.includes(m[1].toLowerCase())) { unit = m[1]; rest = m[2]; }
      return { quantity, unit, name: rest };
    });
}
export const COMMON_UNITS = ['', 'cup', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'l', 'pinch', 'clove', 'can', 'slice'];

export function formatIngredient(i: Ingredient): string {
  return [i.quantity, i.unit, i.name].map((s) => s.trim()).filter(Boolean).join(' ');
}
