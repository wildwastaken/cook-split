import { CONTAINER_UNITS, lookupUnit, type UnitDef } from './units';

export interface ParsedIngredient {
  raw: string;
  /** Quantity (lower bound for ranges); null for "salt to taste" style lines. */
  qty: number | null;
  /** Upper bound of a range like "2-3", else null. */
  qtyMax: number | null;
  /** Canonical unit id (see units.ts) or null for unitless items like "3 eggs". */
  unit: string | null;
  /** Package size for container units, e.g. "14 oz" in "1 (14 oz) can tomatoes". */
  size: string | null;
  /** Cleaned ingredient name (lowercase, no prep notes). */
  name: string;
  /** Anything after a comma or in parentheses. */
  note: string | null;
  /** True when no quantity was given ("salt to taste", "oil for frying"). */
  toTaste: boolean;
}

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5',
  '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
};
const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, half: 0.5,
};

const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)`;
const QTY_RE = new RegExp(String.raw`^(${NUM})(?:\s*(?:-|to)\s*(${NUM}))?`, 'i');
const WORD_QTY_RE = new RegExp(String.raw`^(${Object.keys(NUMBER_WORDS).join('|')})\b\s*`, 'i');
const SIZE_RE = new RegExp(String.raw`^\(\s*(${NUM})\s*-?\s*([a-zA-Z. ]+?)\s*\)\s*`);
const SIZE_ADJ_RE = /^(large|medium|small|heaping|level|scant|generous|big)\s+/i;
const TO_TASTE_RE = /\b(to taste|as needed|as desired|for garnish|for serving|for sprinkling|for dusting)\b/i;

/** Parse "2 1/2", "1/2", "1.5", "3" into a number. */
export function parseNumber(s: string): number {
  const t = s.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) === 0 ? NaN : Number(frac[1]) / Number(frac[2]);
  return Number(t);
}

/** Replace unicode fractions ("2½" -> "2 1/2"), fancy dashes, bullets, list numbers. */
export function preprocess(line: string): string {
  let s = line.replace(/[⁄∕]/g, '/');
  s = s.replace(new RegExp(`(\\d)?\\s*([${FRACTION_CHARS}])`, 'g'), (_m, d: string | undefined, f: string) =>
    `${d ? d + ' ' : ''}${UNICODE_FRACTIONS[f]}`,
  );
  s = s.replace(/[‒–—−]/g, '-');
  s = s.replace(/ /g, ' ');
  s = s.replace(/^\s*(?:[-*•·▢□☐]+|\d+[.)](?=\s))\s*/, '');
  return s.replace(/\s+/g, ' ').trim();
}

/** Try to read a unit at the start of `s`. Supports two-word units like "fl oz". */
function readUnit(s: string): { unit: UnitDef; rest: string } | null {
  const m = s.match(/^([A-Za-z]+\.?)(?:\s+([A-Za-z]+\.?))?/);
  if (!m) return null;
  if (m[2]) {
    const two = lookupUnit(`${m[1].replace(/\.$/, '')} ${m[2].replace(/\.$/, '')}`) ?? lookupUnit(`${m[1]} ${m[2]}`);
    if (two) return { unit: two, rest: s.slice(m[0].length) };
  }
  const one = lookupUnit(m[1]);
  if (!one) return null;
  // Don't treat a one-letter token as a unit if it is followed by an apostrophe word, etc.
  return { unit: one, rest: s.slice(m[1].length) };
}

/** Parse one free-text ingredient line. Returns null for blank / header lines. */
export function parseIngredientLine(line: string): ParsedIngredient | null {
  const raw = line.trim();
  let s = preprocess(line);
  if (!s) return null;
  // Section headers like "For the sauce:" or "Dough".
  if (/:$/.test(s)) return null;

  let qty: number | null = null;
  let qtyMax: number | null = null;
  let unit: UnitDef | null = null;
  let size: string | null = null;
  const notes: string[] = [];

  const qm = s.match(QTY_RE);
  if (qm) {
    qty = parseNumber(qm[1]);
    if (qm[2]) qtyMax = parseNumber(qm[2]);
    s = s.slice(qm[0].length).trim();
  } else {
    const wm = s.match(WORD_QTY_RE);
    // Only accept word quantities if something follows ("a pinch of salt", "two eggs").
    if (wm && s.slice(wm[0].length).trim()) {
      qty = NUMBER_WORDS[wm[1].toLowerCase()];
      s = s.slice(wm[0].length).trim();
    }
  }
  if (qty !== null && !isFinite(qty)) qty = null;
  if (qtyMax !== null && (!isFinite(qtyMax) || qtyMax < (qty ?? 0))) qtyMax = null;

  // Package size: "1 (14 oz) can tomatoes" / "2 (8-ounce) packages cream cheese".
  const sm = s.match(SIZE_RE);
  if (sm) {
    const sizeUnit = lookupUnit(sm[2].trim());
    const sizeQty = parseNumber(sm[1]);
    if (sizeUnit && isFinite(sizeQty)) {
      size = `${Math.round(sizeQty * 100) / 100} ${sizeUnit.singular}`;
      s = s.slice(sm[0].length).trim();
    }
  }

  // Optional size adjective before a unit: "2 large cloves garlic".
  let adjective: string | null = null;
  const am = s.match(SIZE_ADJ_RE);
  if (am) {
    const afterAdj = s.slice(am[0].length);
    const u = readUnit(afterAdj);
    if (u) {
      adjective = am[1].toLowerCase();
      unit = u.unit;
      s = u.rest.trim();
    }
  }
  if (!unit) {
    const u = readUnit(s);
    // Only accept a bare unit when there's a quantity, or for "pinch of salt" style lines.
    if (u && (qty !== null || ['pinch', 'dash', 'handful', 'bunch', 'sprig'].includes(u.unit.id))) {
      const rest = u.rest.trim();
      // Avoid eating a word that is actually the ingredient ("1 can" with nothing after is fine).
      if (rest || qty !== null) {
        unit = u.unit;
        s = rest;
        if (qty === null) qty = 1;
      }
    }
  }
  if (unit && size && !CONTAINER_UNITS.has(unit.id)) {
    // "(14 oz)" followed by a non-container unit: keep size as a note.
    notes.push(size);
    size = null;
  }
  s = s.replace(/^of\s+/i, '').trim();

  // Pull out parentheticals.
  s = s.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    if (inner.trim()) notes.push(inner.trim());
    return ' ';
  });
  // Split name / note at the first comma.
  const commaIdx = s.indexOf(',');
  let name = commaIdx >= 0 ? s.slice(0, commaIdx) : s;
  if (commaIdx >= 0) {
    const after = s.slice(commaIdx + 1).trim();
    if (after) notes.push(after);
  }
  name = name
    .replace(TO_TASTE_RE, ' ')
    .replace(/\b(optional)\b/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (adjective) name = `${adjective} ${name}`.trim();

  // "2 garlic cloves" -> 2 clove garlic.
  if (!unit && qty !== null) {
    const cm = name.match(/^(.*\bgarlic)\s+cloves?$/);
    if (cm) {
      unit = lookupUnit('clove');
      name = cm[1];
    }
  }

  if (!name) {
    // Something like "2 cups" alone - treat the unit as the name so nothing is lost.
    name = unit ? unit.plural : raw.toLowerCase();
    unit = null;
  }
  return {
    raw,
    qty,
    qtyMax,
    unit: unit ? unit.id : null,
    size,
    name,
    note: notes.length ? notes.join('; ') : null,
    // No quantity means "buy some": "salt to taste", "olive oil for frying".
    toTaste: qty === null,
  };
}

/** Parse a whole pasted recipe block (one ingredient per line). */
export function parseIngredients(text: string): ParsedIngredient[] {
  return text
    .split(/\r?\n/)
    .map(parseIngredientLine)
    .filter((x): x is ParsedIngredient => x !== null);
}
