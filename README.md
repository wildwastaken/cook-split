# Cook Split

A small web app for cooking big dinners with friends:

1. **Recipes**: pick from past recipes (Chicken Alfredo, Butter Chicken, Beef Bulgogi, Beef Tacos, Spaghetti Bolognese, plus anything you save with "Save to past recipes", kept on this device) or paste your own ingredient lists, then set how many people are eating. Each recipe has a base servings number and is scaled to the headcount.
2. **Groceries**: you get one combined shopping list. Amounts are scaled, merged across recipes, unit-converted, rounded up to shopper-friendly sizes, and grouped by store section. You can check items off while shopping, copy the list as text, or print it.
3. **Split**: enter who ate and what each person paid. Anything marked "not split" on the grocery list (rice someone keeps, say) gets a cost and a buyer here and comes off that person's receipt before the split. The app works out balances and the fewest transfers to settle up, with Venmo pay links for anyone who has a handle.

There's no backend. State is saved in `localStorage` on your device. **Share link** copies a URL with the whole dinner compressed into the hash (`#d=…`), so a friend can open the same dinner.

## Run it

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest unit tests
npm run build      # type-check + production build to dist/
npm run preview    # serve dist/
```

`dist/` is fully static (relative asset paths), so you can drop it on any static host.

## How the grocery math works

- **Parser** (`src/lib/parse.ts`) understands lines like `2 1/2 cups flour`, `2½ cups flour`, `3 cloves garlic, minced`, `1 (14 oz) can tomatoes`, `2-3 tbsp oil`, `a pinch of salt`, `3 eggs`, `salt to taste`. Unit aliases include cup/cups/c, tbsp/tablespoon/T, tsp/teaspoon/t, oz, lb, g, kg, ml, l, fl oz, clove, can, pinch, and more. Lines ending in `:` are treated as section headers and skipped.
- **Normalization** (`src/lib/normalize.ts`) lowercases names, strips prep words (minced, chopped, diced, fresh, large…), singularizes simple plurals, and maps a few synonyms (all-purpose flour → flour, kosher salt → salt, scallion → green onion). Product names such as "crushed tomatoes" keep their prep word.
- **Merging** (`src/lib/merge.ts`): volume merges with volume (via ml) and mass with mass (via g). Volume and mass are never converted into each other, so "1 cup + 100 g butter" stays as two amounts. Count units (cloves, cans, pinches…) merge only with the same unit, and cans only with the same size. Ranges shop for the top of the range. Water is left off the list.
- **Rounding** always rounds up: tsp to ¼, tbsp to ½, cups to ¼ or ⅓, oz to ½ or 1, lb to ¼, and whole numbers for counts.
- **Sections** (`src/lib/sections.ts`) come from a keyword map that tries the longest match first, so "garlic powder" goes to spices and "garlic" to produce. The last word of a name can also override, so "chicken broth" goes to pantry. Canned items go to pantry.

## How the split works

`src/lib/settle.ts`. All math is in integer cents. The total is split evenly among the people who ate, and leftover cents go to the first few attendees. Someone who paid but didn't eat gets fully reimbursed. Not-split items are subtracted from their buyer's payment first, never below zero. Settlement uses a bitmask DP to find the most zero-sum subgroups. That gives the true minimum number of transfers for up to 16 people with non-zero balances. Inside each group it uses greedy largest-creditor/largest-debtor matching. Larger groups fall back to plain greedy.

Venmo links look like `https://venmo.com/?txn=pay&recipients=<handle>&amount=<x>&note=<note>` and appear only when the person being paid has a handle.

## Limitations

- The parser is heuristic, not a full natural-language parser. Use "Check how it was read" under each recipe to spot misreads.
- There are no ingredient densities, so volume and weight of the same ingredient show as separate amounts.
- The split is even among attendees only. "Some people only ate X" isn't supported.
- Share links contain the full recipe text and can get long for many recipes.
