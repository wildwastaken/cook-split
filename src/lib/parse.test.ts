import { describe, expect, it } from 'vitest';
import { parseIngredientLine, parseIngredients, parseNumber, preprocess } from './parse';

const p = (s: string) => parseIngredientLine(s)!;

describe('parseNumber / preprocess', () => {
  it('parses integers, decimals, fractions and mixed numbers', () => {
    expect(parseNumber('3')).toBe(3);
    expect(parseNumber('1.5')).toBe(1.5);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('1/4')).toBe(0.25);
    expect(parseNumber('2 1/2')).toBe(2.5);
  });
  it('expands unicode fractions and strips bullets', () => {
    expect(preprocess('½ cup sugar')).toBe('1/2 cup sugar');
    expect(preprocess('2½ cups flour')).toBe('2 1/2 cups flour');
    expect(preprocess('1 ¼ cups milk')).toBe('1 1/4 cups milk');
    expect(preprocess('- 2 eggs')).toBe('2 eggs');
    expect(preprocess('• 1 lemon')).toBe('1 lemon');
    expect(preprocess('1 1⁄2 cups rice')).toBe('1 1/2 cups rice');
  });
});

describe('parseIngredientLine', () => {
  it('handles mixed numbers with units', () => {
    expect(p('2 1/2 cups flour')).toMatchObject({ qty: 2.5, unit: 'cup', name: 'flour' });
  });
  it('handles unicode fractions', () => {
    expect(p('½ tsp salt')).toMatchObject({ qty: 0.5, unit: 'tsp', name: 'salt' });
    expect(p('1 ½ cups chocolate chips')).toMatchObject({ qty: 1.5, unit: 'cup', name: 'chocolate chips' });
    expect(p('2¼ cups flour')).toMatchObject({ qty: 2.25, unit: 'cup' });
  });
  it('splits prep notes after a comma', () => {
    expect(p('3 cloves garlic, minced')).toMatchObject({ qty: 3, unit: 'clove', name: 'garlic', note: 'minced' });
  });
  it('reads package sizes', () => {
    expect(p('1 (14 oz) can tomatoes')).toMatchObject({ qty: 1, unit: 'can', size: '14 oz', name: 'tomatoes' });
    expect(p('2 (8-ounce) packages cream cheese')).toMatchObject({
      qty: 2,
      unit: 'package',
      size: '8 oz',
      name: 'cream cheese',
    });
  });
  it('marks to-taste items with no quantity', () => {
    expect(p('salt to taste')).toMatchObject({ qty: null, unit: null, name: 'salt', toTaste: true });
    expect(p('black pepper, to taste')).toMatchObject({ qty: null, name: 'black pepper', toTaste: true });
  });
  it('handles ranges', () => {
    expect(p('2-3 tbsp olive oil')).toMatchObject({ qty: 2, qtyMax: 3, unit: 'tbsp', name: 'olive oil' });
    expect(p('2 – 3 lb potatoes')).toMatchObject({ qty: 2, qtyMax: 3, unit: 'lb' });
    expect(p('4 to 6 cups broth')).toMatchObject({ qty: 4, qtyMax: 6, unit: 'cup' });
  });
  it('handles unitless items', () => {
    expect(p('3 eggs')).toMatchObject({ qty: 3, unit: null, name: 'eggs' });
    expect(p('1 red bell pepper, sliced')).toMatchObject({ qty: 1, unit: null, name: 'red bell pepper' });
  });
  it('knows unit aliases', () => {
    const cases: [string, string][] = [
      ['1 c milk', 'cup'],
      ['1 cup milk', 'cup'],
      ['2 cups milk', 'cup'],
      ['1 tablespoon oil', 'tbsp'],
      ['1 Tbsp. oil', 'tbsp'],
      ['1 T oil', 'tbsp'],
      ['1 t salt', 'tsp'],
      ['1 teaspoon salt', 'tsp'],
      ['8 oz cheddar', 'oz'],
      ['8 ounces cheddar', 'oz'],
      ['2 lbs beef', 'lb'],
      ['1 pound beef', 'lb'],
      ['500 g pasta', 'g'],
      ['500g pasta', 'g'],
      ['1 kg potatoes', 'kg'],
      ['250 ml milk', 'ml'],
      ['1 l stock', 'l'],
      ['1 liter stock', 'l'],
      ['4 fl oz cream', 'floz'],
      ['1 pinch nutmeg', 'pinch'],
      ['2 cans beans', 'can'],
    ];
    for (const [line, unit] of cases) expect(p(line).unit, line).toBe(unit);
  });
  it('handles word quantities and "of"', () => {
    expect(p('a pinch of salt')).toMatchObject({ qty: 1, unit: 'pinch', name: 'salt' });
    expect(p('pinch of cayenne')).toMatchObject({ qty: 1, unit: 'pinch', name: 'cayenne' });
    expect(p('two eggs')).toMatchObject({ qty: 2, unit: null, name: 'eggs' });
  });
  it('normalizes "garlic cloves" to the clove unit', () => {
    expect(p('2 garlic cloves')).toMatchObject({ qty: 2, unit: 'clove', name: 'garlic' });
  });
  it('keeps size adjectives in the name and parentheticals in the note', () => {
    expect(p('2 large eggs')).toMatchObject({ qty: 2, unit: null, name: 'large eggs' });
    expect(p('1 cup butter (2 sticks)')).toMatchObject({ qty: 1, unit: 'cup', name: 'butter', note: '2 sticks' });
  });
  it('does not treat words starting with unit letters as units', () => {
    expect(p('2 carrots')).toMatchObject({ unit: null, name: 'carrots' });
    expect(p('1 lemon')).toMatchObject({ unit: null, name: 'lemon' });
    expect(p('4 tomatoes')).toMatchObject({ unit: null, name: 'tomatoes' });
  });
  it('skips blank lines and section headers', () => {
    expect(parseIngredientLine('')).toBeNull();
    expect(parseIngredientLine('   ')).toBeNull();
    expect(parseIngredientLine('For the sauce:')).toBeNull();
    expect(parseIngredients('1 egg\n\nSauce:\n2 tbsp soy sauce')).toHaveLength(2);
  });
});
