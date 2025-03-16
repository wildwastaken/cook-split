/** Recipes we've cooked before, plus any you save from the Recipes tab (kept on this device). */

export interface LibraryRecipe {
  title: string;
  servings: number;
  text: string;
  /** true for recipes saved on this device, false for the built-in ones. */
  saved?: boolean;
}

export const PAST_RECIPES: LibraryRecipe[] = [
  {
    title: 'Chicken Alfredo',
    servings: 4,
    text: `1 lb fettuccine
1 1/2 lb boneless chicken breasts
2 tbsp olive oil
4 tbsp unsalted butter
4 cloves garlic, minced
2 cups heavy cream
1 1/2 cups grated parmesan
1 tsp kosher salt
black pepper to taste
2 tbsp fresh parsley, chopped`,
  },
  {
    title: 'Butter Chicken',
    servings: 6,
    text: `2 lb boneless chicken thighs
1 cup plain yogurt
2 tbsp garam masala
1 tsp ground turmeric
1 tbsp chili powder
4 tbsp unsalted butter
1 yellow onion, diced
6 cloves garlic, minced
1 tbsp grated ginger
1 (15 oz) can tomato sauce
1 cup heavy cream
1 tsp kosher salt
1/4 cup fresh cilantro, chopped
3 cups basmati rice
6 naan`,
  },
  {
    title: 'Beef Bulgogi',
    servings: 4,
    text: `2 lb thinly sliced ribeye
1/2 cup soy sauce
3 tbsp brown sugar
1 tbsp sesame oil
5 cloves garlic, minced
1 tbsp grated ginger
1 asian pear, grated
4 green onions, chopped
1 tbsp sesame seeds
2 cups jasmine rice`,
  },
  {
    title: 'Beef Tacos',
    servings: 6,
    text: `2 lb ground beef
3 tbsp taco seasoning
12 corn tortillas
1 yellow onion, diced
2 cups shredded cheddar
2 tomatoes, diced
1 cup sour cream
2 limes
1/2 cup fresh cilantro, chopped
salt to taste`,
  },
  {
    title: 'Spaghetti Bolognese',
    servings: 6,
    text: `1 1/2 lb spaghetti
1 lb ground beef
1/2 lb ground pork
1 yellow onion, diced
2 carrots, diced
4 cloves garlic, minced
2 tbsp tomato paste
1 (28 oz) can crushed tomatoes
1/2 cup whole milk
1 tsp kosher salt
1/2 cup grated parmesan`,
  },
];

export const LIBRARY_KEY = 'cook-split:library:v1';

export function loadSaved(): LibraryRecipe[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => r && typeof r.title === 'string' && r.title.trim() && typeof r.text === 'string')
      .slice(0, 100)
      .map((r) => ({
        title: r.title.slice(0, 120),
        servings: Number.isFinite(r.servings) && r.servings > 0 ? r.servings : 4,
        text: r.text.slice(0, 20000),
        saved: true,
      }));
  } catch {
    return [];
  }
}

export function storeSaved(list: LibraryRecipe[]): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(list.map(({ title, servings, text }) => ({ title, servings, text }))));
  } catch {
    /* storage full / disabled */
  }
}

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Saved recipes first (they replace a built-in with the same name), then the built-ins. */
export function fullLibrary(saved: LibraryRecipe[]): LibraryRecipe[] {
  return [...saved, ...PAST_RECIPES.filter((p) => !saved.some((s) => sameTitle(s.title, p.title)))];
}

/** Add or replace a saved recipe by title. */
export function upsertSaved(saved: LibraryRecipe[], r: LibraryRecipe): LibraryRecipe[] {
  const entry = { title: r.title.trim(), servings: r.servings, text: r.text, saved: true };
  return [entry, ...saved.filter((s) => !sameTitle(s.title, r.title))];
}

export function removeSaved(saved: LibraryRecipe[], title: string): LibraryRecipe[] {
  return saved.filter((s) => !sameTitle(s.title, title));
}

export { sameTitle };
