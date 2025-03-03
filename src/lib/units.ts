/** Unit definitions. Volume units convert via ml, mass via g; everything else is a "count" unit. */
export type Dimension = 'volume' | 'mass' | 'count';
export type UnitSystem = 'us' | 'metric' | 'none';

export interface UnitDef {
  id: string;
  dimension: Dimension;
  /** ml per unit (volume) or g per unit (mass); 1 for count units. */
  toBase: number;
  system: UnitSystem;
  singular: string;
  plural: string;
}

const def = (
  id: string,
  dimension: Dimension,
  toBase: number,
  system: UnitSystem,
  singular: string,
  plural: string,
): UnitDef => ({ id, dimension, toBase, system, singular, plural });

export const UNITS: Record<string, UnitDef> = {
  tsp: def('tsp', 'volume', 4.92892, 'us', 'tsp', 'tsp'),
  tbsp: def('tbsp', 'volume', 14.7868, 'us', 'tbsp', 'tbsp'),
  floz: def('floz', 'volume', 29.5735, 'us', 'fl oz', 'fl oz'),
  cup: def('cup', 'volume', 236.588, 'us', 'cup', 'cups'),
  pint: def('pint', 'volume', 473.176, 'us', 'pint', 'pints'),
  quart: def('quart', 'volume', 946.353, 'us', 'quart', 'quarts'),
  gallon: def('gallon', 'volume', 3785.41, 'us', 'gallon', 'gallons'),
  ml: def('ml', 'volume', 1, 'metric', 'ml', 'ml'),
  l: def('l', 'volume', 1000, 'metric', 'L', 'L'),
  g: def('g', 'mass', 1, 'metric', 'g', 'g'),
  kg: def('kg', 'mass', 1000, 'metric', 'kg', 'kg'),
  oz: def('oz', 'mass', 28.3495, 'us', 'oz', 'oz'),
  lb: def('lb', 'mass', 453.592, 'us', 'lb', 'lb'),
  clove: def('clove', 'count', 1, 'none', 'clove', 'cloves'),
  can: def('can', 'count', 1, 'none', 'can', 'cans'),
  jar: def('jar', 'count', 1, 'none', 'jar', 'jars'),
  package: def('package', 'count', 1, 'none', 'package', 'packages'),
  bag: def('bag', 'count', 1, 'none', 'bag', 'bags'),
  box: def('box', 'count', 1, 'none', 'box', 'boxes'),
  bottle: def('bottle', 'count', 1, 'none', 'bottle', 'bottles'),
  pinch: def('pinch', 'count', 1, 'none', 'pinch', 'pinches'),
  dash: def('dash', 'count', 1, 'none', 'dash', 'dashes'),
  bunch: def('bunch', 'count', 1, 'none', 'bunch', 'bunches'),
  head: def('head', 'count', 1, 'none', 'head', 'heads'),
  sprig: def('sprig', 'count', 1, 'none', 'sprig', 'sprigs'),
  slice: def('slice', 'count', 1, 'none', 'slice', 'slices'),
  stick: def('stick', 'count', 1, 'none', 'stick', 'sticks'),
  stalk: def('stalk', 'count', 1, 'none', 'stalk', 'stalks'),
  handful: def('handful', 'count', 1, 'none', 'handful', 'handfuls'),
  piece: def('piece', 'count', 1, 'none', 'piece', 'pieces'),
};

/** Units that are containers and may be preceded by a size, e.g. "1 (14 oz) can". */
export const CONTAINER_UNITS = new Set(['can', 'jar', 'package', 'bag', 'box', 'bottle']);

const ALIASES: Record<string, string> = {};
const alias = (id: string, ...names: string[]) => {
  for (const n of names) ALIASES[n] = id;
};
alias('tsp', 'tsp', 'tsps', 'teaspoon', 'teaspoons', 'tsp.');
alias('tbsp', 'tbsp', 'tbsps', 'tbs', 'tbl', 'tablespoon', 'tablespoons', 'tbsp.');
alias('floz', 'fl oz', 'fl. oz', 'fluid ounce', 'fluid ounces', 'floz');
alias('cup', 'cup', 'cups', 'c');
alias('pint', 'pint', 'pints', 'pt');
alias('quart', 'quart', 'quarts', 'qt');
alias('gallon', 'gallon', 'gallons', 'gal');
alias('ml', 'ml', 'mls', 'milliliter', 'milliliters', 'millilitre', 'millilitres');
alias('l', 'l', 'liter', 'liters', 'litre', 'litres');
alias('g', 'g', 'gram', 'grams', 'gr');
alias('kg', 'kg', 'kgs', 'kilogram', 'kilograms');
alias('oz', 'oz', 'ounce', 'ounces');
alias('lb', 'lb', 'lbs', 'pound', 'pounds');
alias('clove', 'clove', 'cloves');
alias('can', 'can', 'cans', 'tin', 'tins');
alias('jar', 'jar', 'jars');
alias('package', 'package', 'packages', 'pkg', 'pkgs', 'packet', 'packets');
alias('bag', 'bag', 'bags');
alias('box', 'box', 'boxes');
alias('bottle', 'bottle', 'bottles');
alias('pinch', 'pinch', 'pinches');
alias('dash', 'dash', 'dashes');
alias('bunch', 'bunch', 'bunches');
alias('head', 'head', 'heads');
alias('sprig', 'sprig', 'sprigs');
alias('slice', 'slice', 'slices');
alias('stick', 'stick', 'sticks');
alias('stalk', 'stalk', 'stalks');
alias('handful', 'handful', 'handfuls');
alias('piece', 'piece', 'pieces');

/** Look up a unit token. Handles the classic "T" (tablespoon) vs "t" (teaspoon). */
export function lookupUnit(token: string): UnitDef | null {
  if (token === 'T' || token === 'Tb' || token === 'TB') return UNITS.tbsp;
  if (token === 't') return UNITS.tsp;
  const key = token.toLowerCase().replace(/\.$/, '');
  const id = ALIASES[key] ?? ALIASES[token.toLowerCase()];
  return id ? UNITS[id] : null;
}

/**
 * Round up to the next multiple of step (shoppers would rather have a bit extra).
 * A small tolerance keeps float noise from conversions (8 tbsp = 0.500003 cups) from bumping a step.
 */
export function roundUp(x: number, step: number): number {
  return Math.ceil(x / step - 1e-3) * step;
}

export interface DisplayAmount {
  value: number;
  unit: UnitDef | null;
}

/**
 * Pick a shopper-friendly unit + rounded value for a summed base quantity.
 * `system` is the preferred system: 'metric' only if every contribution was metric.
 */
export function toShopperAmount(base: number, dimension: Dimension, system: UnitSystem): DisplayAmount {
  if (dimension === 'volume') {
    if (system === 'metric') {
      if (base >= 1000) return { value: roundUp(base / 1000, 0.25), unit: UNITS.l };
      const step = base < 50 ? 5 : base < 250 ? 10 : 25;
      return { value: roundUp(base, step), unit: UNITS.ml };
    }
    if (base < UNITS.tbsp.toBase - 0.01) return { value: roundUp(base / UNITS.tsp.toBase, 0.25), unit: UNITS.tsp };
    if (base < UNITS.cup.toBase / 3 - 0.01) return { value: roundUp(base / UNITS.tbsp.toBase, 0.5), unit: UNITS.tbsp };
    if (base < UNITS.cup.toBase * 8 - 0.01) {
      const cups = base / UNITS.cup.toBase;
      // Measuring cups come in quarters and thirds; take whichever is the closer step up.
      const value = cups < 2 ? Math.min(roundUp(cups, 0.25), roundUp(cups, 1 / 3)) : roundUp(cups, 0.25);
      return { value, unit: UNITS.cup };
    }
    return { value: roundUp(base / UNITS.quart.toBase, 0.5), unit: UNITS.quart };
  }
  if (dimension === 'mass') {
    if (system === 'metric') {
      if (base >= 1000) return { value: roundUp(base / 1000, 0.1), unit: UNITS.kg };
      const step = base < 50 ? 5 : base < 500 ? 10 : 25;
      return { value: roundUp(base, step), unit: UNITS.g };
    }
    const oz = base / UNITS.oz.toBase;
    if (oz < 16 - 0.01) return { value: roundUp(oz, oz < 4 ? 0.5 : 1), unit: UNITS.oz };
    return { value: roundUp(base / UNITS.lb.toBase, 0.25), unit: UNITS.lb };
  }
  return { value: base, unit: null };
}

const FRACTION_GLYPHS: [number, string][] = [
  [0.125, '⅛'],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.375, '⅜'],
  [0.5, '½'],
  [0.625, '⅝'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
  [0.875, '⅞'],
];

/** Format a number with nice fraction glyphs: 1.5 -> "1½", 0.25 -> "¼", 2.3 -> "2.3". */
export function formatQty(n: number): string {
  if (!isFinite(n)) return '';
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.01) return String(whole);
  for (const [v, g] of FRACTION_GLYPHS) {
    if (Math.abs(frac - v) < 0.01) return whole > 0 ? `${whole}${g}` : g;
  }
  return String(Math.round(n * 100) / 100);
}

export function unitLabel(unit: UnitDef, value: number): string {
  return value > 1 + 1e-9 ? unit.plural : unit.singular;
}
