import { describe, expect, it } from 'vitest';
import { buildGroceryList, groceryListText, mergeLines, scaleFactor, type Recipe } from './merge';
import { normalizeName, singularize } from './normalize';
import { parseIngredientLine } from './parse';
import { sectionFor } from './sections';
import { formatQty, roundUp, toShopperAmount, UNITS } from './units';
import { SAMPLE_RECIPES } from '../samples';

const line = (text: string, factor = 1, recipeTitle = 'R') => ({
  recipeTitle,
  parsed: parseIngredientLine(text)!,
  factor,
});
const find = (items: ReturnType<typeof mergeLines>, key: string) => items.find((i) => i.key === key)!;

describe('normalizeName', () => {
  it('lowercases, singularizes and strips prep words', () => {
    expect(normalizeName('Garlic, minced')).toBe('garlic');
    expect(normalizeName('Tomatoes')).toBe('tomato');
    expect(normalizeName('fresh basil leaves')).toBe('basil');
    expect(normalizeName('bay leaves')).toBe('bay leaf');
    expect(normalizeName('finely chopped onions')).toBe('onion');
    expect(normalizeName('salt to taste')).toBe('salt');
    expect(normalizeName('berries')).toBe('berry');
    expect(normalizeName('large eggs')).toBe('egg');
    expect(normalizeName('all-purpose flour')).toBe('flour');
    expect(normalizeName('kosher salt')).toBe('salt');
    expect(normalizeName('scallions')).toBe('green onion');
  });
  it('keeps product names that contain prep words', () => {
    expect(normalizeName('crushed tomatoes')).toBe('crushed tomato');
    expect(normalizeName('crushed garlic')).toBe('garlic');
    expect(normalizeName('whole wheat flour')).toBe('whole wheat flour');
  });
  it('leaves words that only look plural alone', () => {
    expect(singularize('asparagus')).toBe('asparagus');
    expect(singularize('molasses')).toBe('molasses');
    expect(singularize('glass')).toBe('glass');
    expect(singularize('peaches')).toBe('peach');
  });
});

describe('units', () => {
  it('rounds up to a step', () => {
    expect(roundUp(1.1, 0.25)).toBe(1.25);
    expect(roundUp(1.25, 0.25)).toBe(1.25);
  });
  it('formats fractions', () => {
    expect(formatQty(1.5)).toBe('1½');
    expect(formatQty(0.25)).toBe('¼');
    expect(formatQty(3)).toBe('3');
    expect(formatQty(2.3)).toBe('2.3');
  });
  it('picks shopper-friendly volume units', () => {
    expect(toShopperAmount(UNITS.tsp.toBase * 2, 'volume', 'us')).toMatchObject({ value: 2, unit: UNITS.tsp });
    expect(toShopperAmount(UNITS.tsp.toBase * 3, 'volume', 'us')).toMatchObject({ value: 1, unit: UNITS.tbsp });
    expect(toShopperAmount(UNITS.tbsp.toBase * 8, 'volume', 'us')).toMatchObject({ value: 0.5, unit: UNITS.cup });
    expect(toShopperAmount(UNITS.tbsp.toBase * 4.5, 'volume', 'us')).toMatchObject({ value: 4.5, unit: UNITS.tbsp });
    expect(toShopperAmount(UNITS.cup.toBase * 0.6, 'volume', 'us').value).toBeCloseTo(2 / 3);
    expect(toShopperAmount(1500, 'volume', 'metric')).toMatchObject({ value: 1.5, unit: UNITS.l });
  });
  it('picks shopper-friendly mass units', () => {
    expect(toShopperAmount(UNITS.oz.toBase * 24, 'mass', 'us')).toMatchObject({ value: 1.5, unit: UNITS.lb });
    expect(toShopperAmount(UNITS.oz.toBase * 6.2, 'mass', 'us')).toMatchObject({ value: 7, unit: UNITS.oz });
    expect(toShopperAmount(430, 'mass', 'metric')).toMatchObject({ value: 430, unit: UNITS.g });
  });
});

describe('mergeLines', () => {
  it('merges the same ingredient across recipes', () => {
    const items = mergeLines([line('4 cloves garlic, minced', 1, 'A'), line('3 cloves garlic', 1, 'B')]);
    const g = find(items, 'garlic');
    expect(g.amounts).toHaveLength(1);
    expect(g.amounts[0]).toMatchObject({ value: 7, unit: 'clove', text: '7 cloves' });
    expect(g.sources).toEqual(['A', 'B']);
  });
  it('converts compatible volume units', () => {
    const items = mergeLines([line('1 cup milk'), line('4 tbsp milk')]);
    expect(find(items, 'milk').amounts[0]).toMatchObject({ value: 1.25, unit: 'cup' });
  });
  it('converts compatible mass units', () => {
    const items = mergeLines([line('1 lb ground beef'), line('8 oz ground beef')]);
    expect(find(items, 'ground beef').amounts[0]).toMatchObject({ value: 1.5, unit: 'lb' });
  });
  it('mixes metric and US by falling back to US units', () => {
    const items = mergeLines([line('1 cup stock'), line('250 ml stock')]);
    const a = find(items, 'stock').amounts[0];
    expect(a.unit).toBe('cup');
    expect(a.value).toBe(2.25); // 236.6 + 250 = 486.6 ml = 2.06 cups -> round up to 2¼
  });
  it('keeps metric when everything is metric', () => {
    const items = mergeLines([line('200 g pasta'), line('300g pasta')]);
    expect(find(items, 'pasta').amounts[0]).toMatchObject({ value: 500, unit: 'g' });
  });
  it('does not convert volume to mass', () => {
    const items = mergeLines([line('1 cup butter'), line('100 g butter')]);
    const b = find(items, 'butter');
    expect(b.amounts.map((a) => a.unit).sort()).toEqual(['cup', 'g']);
  });
  it('scales and rounds counts up', () => {
    const items = mergeLines([line('3 eggs', 1.5)]);
    const e = find(items, 'egg');
    expect(e.amounts[0]).toMatchObject({ value: 5, unit: null }); // 4.5 -> 5
    expect(e.name).toBe('eggs');
  });
  it('keeps differently sized cans separate', () => {
    const items = mergeLines([line('1 (14 oz) can tomatoes'), line('1 (28 oz) can tomatoes'), line('1 (14 oz) can tomatoes')]);
    const t = find(items, 'tomato');
    expect(t.amounts.map((a) => a.text).sort()).toEqual(['1 can (28 oz)', '2 cans (14 oz)']);
    expect(t.section).toBe('pantry');
  });
  it('records to-taste items without amounts', () => {
    const items = mergeLines([line('salt to taste'), line('1 tsp salt')]);
    const s = find(items, 'salt');
    expect(s.alsoToTaste).toBe(true);
    expect(s.amounts[0]).toMatchObject({ value: 1, unit: 'tsp' });
  });
  it('uses the top of a range', () => {
    const items = mergeLines([line('2-3 tbsp olive oil')]);
    expect(find(items, 'olive oil').amounts[0]).toMatchObject({ value: 3, unit: 'tbsp' });
  });
  it('skips water', () => {
    expect(mergeLines([line('1 cup water')])).toHaveLength(0);
  });
});

describe('sections', () => {
  it('categorizes common ingredients', () => {
    expect(sectionFor('garlic')).toBe('produce');
    expect(sectionFor('garlic powder')).toBe('spices');
    expect(sectionFor('red bell pepper')).toBe('produce');
    expect(sectionFor('black pepper')).toBe('spices');
    expect(sectionFor('chicken thigh')).toBe('meat & seafood');
    expect(sectionFor('chicken broth')).toBe('pantry');
    expect(sectionFor('egg')).toBe('dairy & eggs');
    expect(sectionFor('eggplant')).toBe('produce');
    expect(sectionFor('peanut butter')).toBe('pantry');
    expect(sectionFor('frozen pea')).toBe('frozen');
    expect(sectionFor('baguette')).toBe('bakery');
    expect(sectionFor('tomato', 'can')).toBe('pantry');
    expect(sectionFor('unobtainium')).toBe('other');
  });
});

describe('buildGroceryList', () => {
  const recipes: Recipe[] = SAMPLE_RECIPES.map((r, i) => ({ ...r, id: String(i), selected: true }));

  it('scale factor is headcount / servings', () => {
    expect(scaleFactor(4, 8)).toBe(2);
    expect(scaleFactor(0, 8)).toBe(1);
  });
  it('builds a merged, scaled list from the samples', () => {
    const items = buildGroceryList(recipes, 8);
    // pasta + stir-fry garlic: (4 + 3) cloves * 2
    expect(find(items, 'garlic').amounts[0]).toMatchObject({ value: 14, unit: 'clove' });
    // salt: pasta 1 tsp*2 + cookies 1 tsp*(8/12) = 2.67 tsp -> 2¾ tsp, plus to taste from stir-fry
    const salt = find(items, 'salt');
    expect(salt.amounts[0]).toMatchObject({ value: 2.75, unit: 'tsp' });
    expect(salt.alsoToTaste).toBe(true);
    // sugar from "granulated sugar" and brown sugar stay separate
    expect(find(items, 'sugar')).toBeTruthy();
    expect(find(items, 'brown sugar')).toBeTruthy();
    const text = groceryListText(items);
    expect(text).toContain('PRODUCE');
    expect(text).toContain('14 cloves garlic');
  });
  it('ignores unselected recipes', () => {
    const only = recipes.map((r, i) => ({ ...r, selected: i === 2 }));
    const items = buildGroceryList(only, 12);
    expect(items.find((i) => i.key === 'spaghetti')).toBeUndefined();
    expect(find(items, 'egg').amounts[0].value).toBe(2);
  });
});
