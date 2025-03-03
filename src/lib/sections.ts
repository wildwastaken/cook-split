export type Section =
  | 'produce'
  | 'meat & seafood'
  | 'dairy & eggs'
  | 'bakery'
  | 'pantry'
  | 'spices'
  | 'frozen'
  | 'other';

export const SECTION_ORDER: Section[] = [
  'produce', 'meat & seafood', 'dairy & eggs', 'bakery', 'pantry', 'spices', 'frozen', 'other',
];

const MAP: Record<Exclude<Section, 'other'>, string[]> = {
  produce: [
    'onion', 'red onion', 'yellow onion', 'green onion', 'garlic', 'shallot', 'ginger', 'tomato',
    'cherry tomato', 'potato', 'sweet potato', 'carrot', 'celery', 'bell pepper', 'jalapeno',
    'jalapeño', 'chili', 'chile', 'lettuce', 'romaine', 'spinach', 'kale', 'arugula', 'cabbage',
    'broccoli', 'broccoli floret', 'cauliflower', 'zucchini', 'squash', 'mushroom', 'cucumber',
    'avocado', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berry', 'strawberry', 'blueberry',
    'raspberry', 'grape', 'mango', 'pineapple', 'peach', 'pear', 'cilantro', 'parsley', 'basil',
    'mint', 'dill', 'rosemary', 'thyme', 'sage', 'chive', 'snap pea', 'snow pea', 'bok choy',
    'bean sprout', 'eggplant', 'asparagus', 'green bean', 'corn', 'leek', 'radish', 'beet',
    'tofu', 'lemongrass', 'herb',
  ],
  'meat & seafood': [
    'chicken', 'chicken breast', 'chicken thigh', 'beef', 'ground beef', 'steak', 'pork',
    'pork chop', 'bacon', 'sausage', 'turkey', 'lamb', 'ham', 'prosciutto', 'shrimp', 'prawn',
    'salmon', 'cod', 'tilapia', 'fish', 'scallop', 'mussel', 'clam', 'chorizo', 'pancetta',
  ],
  'dairy & eggs': [
    'egg', 'egg yolk', 'egg white', 'milk', 'whole milk', 'butter', 'cream', 'heavy cream',
    'whipping cream', 'sour cream', 'yogurt', 'greek yogurt', 'cheese', 'parmesan', 'mozzarella',
    'cheddar', 'ricotta', 'feta', 'goat cheese', 'cream cheese', 'half-and-half', 'buttermilk',
    'ghee', 'mascarpone',
  ],
  bakery: [
    'bread', 'baguette', 'bun', 'roll', 'tortilla', 'pita', 'naan', 'croissant', 'bagel',
    'sourdough', 'ciabatta', 'english muffin',
  ],
  pantry: [
    'flour', 'sugar', 'brown sugar', 'powdered sugar', 'rice', 'jasmine rice', 'basmati rice',
    'pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'macaroni', 'noodle', 'ramen',
    'oil', 'olive oil', 'vegetable oil', 'canola oil', 'sesame oil', 'coconut oil', 'vinegar',
    'soy sauce', 'sauce', 'broth', 'stock', 'honey', 'maple syrup', 'syrup', 'baking powder',
    'baking soda', 'vanilla', 'vanilla extract', 'extract', 'chocolate', 'chocolate chip', 'cocoa',
    'cocoa powder', 'oats', 'oat', 'bean', 'black bean', 'kidney bean', 'chickpea', 'lentil',
    'peanut butter', 'nut', 'almond', 'walnut', 'pecan', 'peanut', 'cashew', 'crushed tomato',
    'diced tomato', 'tomato paste', 'tomato sauce', 'coconut milk', 'cornstarch', 'breadcrumb',
    'panko', 'yeast', 'ketchup', 'mustard', 'dijon mustard', 'mayonnaise', 'mayo', 'sriracha',
    'hoisin', 'hoisin sauce', 'fish sauce', 'oyster sauce', 'tahini', 'salsa', 'jam', 'raisin',
    'cornmeal', 'quinoa', 'couscous', 'tuna', 'canned', 'wine', 'mirin', 'gochujang', 'miso',
  ],
  spices: [
    'salt', 'flaky salt', 'pepper', 'black pepper', 'white pepper', 'cumin', 'paprika',
    'smoked paprika', 'chili powder', 'chili flake', 'garlic powder', 'onion powder', 'cinnamon',
    'nutmeg', 'oregano', 'red pepper flake', 'cayenne', 'turmeric', 'curry powder', 'bay leaf',
    'ground ginger', 'ground cumin', 'ground cinnamon', 'sesame seed', 'five spice', 'five-spice',
    'italian seasoning', 'seasoning', 'clove', 'cardamom', 'coriander', 'allspice', 'garam masala',
    'peppercorn', 'saffron', 'dried oregano', 'dried thyme', 'dried basil',
  ],
  frozen: ['frozen', 'ice cream', 'frozen pea', 'frozen corn', 'puff pastry', 'ice'],
};

const HEAD_SECTIONS: Record<string, Section> = {
  broth: 'pantry', stock: 'pantry', bouillon: 'pantry', sauce: 'pantry', paste: 'pantry',
  oil: 'pantry', vinegar: 'pantry', syrup: 'pantry', extract: 'pantry', noodle: 'pantry',
  powder: 'spices', flake: 'spices', seasoning: 'spices', seed: 'spices',
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest keywords first so "garlic powder" beats "garlic" and "bell pepper" beats "pepper".
const KEYWORDS: { kw: string; re: RegExp; section: Section }[] = Object.entries(MAP)
  .flatMap(([section, kws]) =>
    kws.map((kw) => ({ kw, re: new RegExp(`(?:^|[^a-z])${escapeRe(kw)}(?:$|[^a-z])`), section: section as Section })),
  )
  .sort((a, b) => b.kw.length - a.kw.length);

/** Guess the store section for a normalized ingredient name (and optional unit id). */
export function sectionFor(name: string, unit?: string | null): Section {
  const n = name.toLowerCase();
  if (/\bfrozen\b/.test(n)) return 'frozen';
  if (/^dried\s/.test(n) && !/(fruit|cranberr|apricot|mango|cherr)/.test(n)) return 'spices';
  if (unit === 'can' || unit === 'jar') return 'pantry';
  // The last word usually says what you're actually buying: "chicken broth" is pantry, not meat.
  const head = n.split(/\s+/).pop() ?? '';
  if (HEAD_SECTIONS[head]) return HEAD_SECTIONS[head];
  for (const { re, section } of KEYWORDS) if (re.test(n)) return section;
  return 'other';
}
