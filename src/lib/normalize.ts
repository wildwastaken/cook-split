/** Ingredient-name normalization used as the merge key. */

const PHRASES = [
  'to taste',
  'as needed',
  'for garnish',
  'for serving',
  'for sprinkling',
  'for dusting',
  'at room temperature',
  'room temperature',
  'plus more',
  'or more',
  'if desired',
  'cut into pieces',
  'bite-sized',
  'bite-size',
];

const PREP_WORDS = [
  'minced', 'chopped', 'diced', 'sliced', 'grated', 'shredded', 'crushed', 'cubed', 'julienned',
  'peeled', 'seeded', 'deveined', 'trimmed', 'rinsed', 'drained', 'halved', 'quartered', 'beaten',
  'softened', 'melted', 'divided', 'packed', 'sifted', 'toasted', 'fresh', 'freshly', 'finely',
  'roughly', 'coarsely', 'thinly', 'thickly', 'large', 'small', 'medium', 'extra-large', 'optional',
  'cold', 'lightly', 'firmly', 'heaping', 'level', 'scant', 'generous', 'about', 'approximately',
  'granulated', 'unsalted', 'whole', 'ripe',
];

// Applied after prep-word stripping and singularizing.
const SYNONYMS: Record<string, string> = {
  'all-purpose flour': 'flour',
  'all purpose flour': 'flour',
  'ap flour': 'flour',
  'white sugar': 'sugar',
  'caster sugar': 'sugar',
  'kosher salt': 'salt',
  'sea salt': 'salt',
  'table salt': 'salt',
  'ground black pepper': 'black pepper',
  'black peppercorn': 'black pepper',
  'scallion': 'green onion',
  'spring onion': 'green onion',
  'garbanzo bean': 'chickpea',
  'extra virgin olive oil': 'olive oil',
  'extra-virgin olive oil': 'olive oil',
  'garlic clove': 'garlic',
  'clove garlic': 'garlic',
  'clove of garlic': 'garlic',
  'egg yolk': 'egg yolk',
  'parmigiano-reggiano': 'parmesan',
  'parmesan cheese': 'parmesan',
  'cilantro leaf': 'cilantro',
  'basil leaf': 'basil',
  'mint leaf': 'mint',
};

const IRREGULAR: Record<string, string> = {
  leaves: 'leaf',
  halves: 'half',
  loaves: 'loaf',
  knives: 'knife',
  children: 'child',
};

const KEEP_S = new Set([
  'molasses', 'hummus', 'asparagus', 'couscous', 'swiss', 'grits', 'oats', 'brussels', 'series',
  'species', 'gas', 'bass', 'citrus',
]);

/** Singularize one English word using simple rules. */
export function singularize(word: string): string {
  const w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (KEEP_S.has(w)) return w;
  if (w.length <= 3) return w;
  if (/[^aeiou]ies$/.test(w)) return w.slice(0, -3) + 'y';
  if (/(oes)$/.test(w)) return w.slice(0, -2);
  if (/(ches|shes|xes|zes|sses)$/.test(w)) return w.slice(0, -2);
  if (/(ss|us|is)$/.test(w)) return w;
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

/** Simple pluralizer for display ("egg" -> "eggs", "tomato" -> "tomatoes"). */
export function pluralize(word: string): string {
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies';
  if (/(tomato|potato)$/.test(word)) return word + 'es';
  if (/(ch|sh|x|z|s)$/.test(word)) return word + 'es';
  if (word.endsWith('leaf')) return word.slice(0, -4) + 'leaves';
  return word + 's';
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PHRASE_RE = new RegExp(`\\b(?:${PHRASES.map(escapeRe).join('|')})\\b`, 'g');
const PREP_RE = new RegExp(`(?<![\\w-])(?:${PREP_WORDS.map(escapeRe).join('|')})(?![\\w-])`, 'g');

// Product names that contain a "prep" word but are a different thing on the shelf.
const PROTECTED: [RegExp, string][] = [
  [/\bcrushed tomato(e?s)?\b/g, 'crushed_tomato$1'],
  [/\bdiced tomato(e?s)?\b/g, 'diced_tomato$1'],
  [/\bcrushed red pepper\b/g, 'crushed_red_pepper'],
  [/\bwhole (wheat|grain)\b/g, 'whole_$1'],
  [/\bsliced almonds?\b/g, 'sliced_almond'],
];

/** Strip notes / prep words but keep the original number ("chocolate chips"). */
export function cleanName(name: string): string {
  let s = name.toLowerCase();
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.split(/[,;]/)[0];
  for (const [re, rep] of PROTECTED) s = s.replace(re, rep);
  s = s.replace(PHRASE_RE, ' ');
  s = s.replace(PREP_RE, ' ');
  s = s.replace(/[^a-z0-9\s&'_-]/g, ' ');
  s = s.replace(/\b(?:and|or|of)\s*$/g, ' ');
  s = s.replace(/^\s*(?:of|a|an|the)\s+/, '');
  s = s.replace(/_/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s || name.trim().toLowerCase();
}

/**
 * Normalize an ingredient name into a merge key:
 * lowercase, drop parentheticals and anything after a comma, strip prep words,
 * singularize the last word, and map a few common synonyms.
 */
export function normalizeName(name: string): string {
  let s = cleanName(name);
  if (SYNONYMS[s]) return SYNONYMS[s];
  const words = s.split(' ');
  words[words.length - 1] = singularize(words[words.length - 1]);
  s = words.join(' ');
  return SYNONYMS[s] ?? s;
}
