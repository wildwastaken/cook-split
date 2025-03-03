import { cleanName, normalizeName, pluralize } from './normalize';
import { parseIngredients, type ParsedIngredient } from './parse';
import { sectionFor, SECTION_ORDER, type Section } from './sections';
import { formatQty, toShopperAmount, unitLabel, UNITS, type Dimension, type UnitSystem } from './units';

export interface Recipe {
  id: string;
  title: string;
  servings: number;
  text: string;
  selected: boolean;
}

export interface ScaledLine {
  recipeTitle: string;
  parsed: ParsedIngredient;
  factor: number;
}

export interface GroceryAmount {
  value: number;
  /** Canonical unit id, or null for plain counts ("3 eggs"). */
  unit: string | null;
  size: string | null;
  text: string;
}

export interface GroceryItem {
  key: string;
  name: string;
  section: Section;
  amounts: GroceryAmount[];
  /** Some recipe listed it without a quantity ("to taste"). */
  alsoToTaste: boolean;
  sources: string[];
}

interface Bucket {
  dimension: Dimension;
  unit: string | null; // for count buckets
  size: string | null;
  total: number; // base units (ml / g) or count
  system: UnitSystem;
}

/** Things nobody needs to buy. */
const SKIP = new Set(['water', 'ice water', 'warm water', 'hot water', 'boiling water', 'cold water']);

export function scaleFactor(recipeServings: number, headcount: number): number {
  if (!(recipeServings > 0) || !(headcount > 0)) return 1;
  return headcount / recipeServings;
}

/** Bucket key: volume / mass merge freely; count units only merge with the same unit + size. */
function bucketKey(p: ParsedIngredient): { key: string; dimension: Dimension } {
  const u = p.unit ? UNITS[p.unit] : null;
  if (u && u.dimension !== 'count') return { key: u.dimension, dimension: u.dimension };
  return { key: `count:${p.unit ?? 'each'}:${p.size ?? ''}`, dimension: 'count' };
}

function countRound(value: number, unit: string | null): number {
  if (unit === 'stick') return Math.ceil(value * 2 - 1e-9) / 2;
  return Math.max(1, Math.ceil(value - 1e-9));
}

function formatAmount(value: number, unit: string | null, size: string | null): string {
  const u = unit ? UNITS[unit] : null;
  const q = formatQty(value);
  if (!u) return `${q}`;
  const sizeText = size ? ` (${size})` : '';
  return `${q} ${unitLabel(u, value)}${sizeText}`;
}

/** Merge a list of scaled lines into grocery items (exported for tests). */
export function mergeLines(lines: ScaledLine[]): GroceryItem[] {
  const byName = new Map<
    string,
    { display: string; buckets: Map<string, Bucket>; toTaste: boolean; sources: Set<string>; units: Set<string | null> }
  >();

  for (const { recipeTitle, parsed, factor } of lines) {
    const key = normalizeName(parsed.name);
    if (!key || SKIP.has(key)) continue;
    let entry = byName.get(key);
    if (!entry) {
      // Show the name as first written ("chocolate chips") unless a synonym changed it.
      const cleaned = cleanName(parsed.name);
      const display = normalizeName(cleaned) === key && !/^(large|small|medium) /.test(cleaned) ? cleaned : key;
      entry = { display, buckets: new Map(), toTaste: false, sources: new Set(), units: new Set() };
      byName.set(key, entry);
    }
    entry.sources.add(recipeTitle);
    entry.units.add(parsed.unit);
    if (parsed.qty === null) {
      entry.toTaste = true;
      continue;
    }
    // For ranges, shop for the upper end.
    const qty = (parsed.qtyMax ?? parsed.qty) * factor;
    const { key: bk, dimension } = bucketKey(parsed);
    const u = parsed.unit ? UNITS[parsed.unit] : null;
    const base = u && dimension !== 'count' ? qty * u.toBase : qty;
    const sys: UnitSystem = u ? u.system : 'none';
    const b = entry.buckets.get(bk);
    if (b) {
      b.total += base;
      if (b.system !== sys) b.system = 'us';
    } else {
      entry.buckets.set(bk, {
        dimension,
        unit: dimension === 'count' ? parsed.unit : null,
        size: dimension === 'count' ? parsed.size : null,
        total: base,
        system: sys,
      });
    }
  }

  const items: GroceryItem[] = [];
  for (const [key, entry] of byName) {
    const amounts: GroceryAmount[] = [];
    const order: Dimension[] = ['count', 'mass', 'volume'];
    const buckets = [...entry.buckets.values()].sort((a, b) => order.indexOf(a.dimension) - order.indexOf(b.dimension));
    let plainCount = 0;
    for (const b of buckets) {
      if (b.dimension === 'count') {
        const value = countRound(b.total, b.unit);
        if (!b.unit) plainCount = value;
        amounts.push({ value, unit: b.unit, size: b.size, text: formatAmount(value, b.unit, b.size) });
      } else {
        const d = toShopperAmount(b.total, b.dimension, b.system);
        amounts.push({ value: d.value, unit: d.unit!.id, size: null, text: formatAmount(d.value, d.unit!.id, null) });
      }
    }
    // Plain counts agree with the number: "1 lemon", "3 eggs". Otherwise use the name as written.
    const onlyPlain = amounts.length === 1 && amounts[0].unit === null;
    const name = onlyPlain ? (plainCount > 1 ? pluralize(key) : key) : entry.display;
    const sectionUnit = [...entry.units].find((u) => u === 'can' || u === 'jar') ?? null;
    items.push({
      key,
      name,
      section: sectionFor(key, sectionUnit),
      amounts,
      alsoToTaste: entry.toTaste,
      sources: [...entry.sources],
    });
  }

  items.sort((a, b) => {
    const s = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
    return s !== 0 ? s : a.key.localeCompare(b.key);
  });
  return items;
}

/** Build the combined grocery list for all selected recipes scaled to the headcount. */
export function buildGroceryList(recipes: Recipe[], headcount: number): GroceryItem[] {
  const lines: ScaledLine[] = [];
  for (const r of recipes) {
    if (!r.selected) continue;
    const factor = scaleFactor(r.servings, headcount);
    for (const parsed of parseIngredients(r.text)) lines.push({ recipeTitle: r.title, parsed, factor });
  }
  return mergeLines(lines);
}

export function groupBySection(items: GroceryItem[]): { section: Section; items: GroceryItem[] }[] {
  return SECTION_ORDER.map((section) => ({ section, items: items.filter((i) => i.section === section) })).filter(
    (g) => g.items.length > 0,
  );
}

export function itemAmountText(item: GroceryItem): string {
  const parts = item.amounts.map((a) => a.text);
  if (parts.length === 0) return 'as needed';
  return parts.join(' + ');
}

/** One line of text for an item, e.g. "2 lb + 1 cup chicken" or "salt (to taste)". */
export function itemLine(item: GroceryItem): string {
  if (item.amounts.length === 0) return `${item.name} (to taste)`;
  return `${itemAmountText(item)} ${item.name}${item.alsoToTaste ? ' (+ extra to taste)' : ''}`;
}

/** Plain-text version of the list for copying into a group chat. */
export function groceryListText(items: GroceryItem[]): string {
  return groupBySection(items)
    .map((g) => `${g.section.toUpperCase()}\n${g.items.map((i) => `- ${itemLine(i)}`).join('\n')}`)
    .join('\n\n');
}
