import { useState } from 'react';
import { scaleFactor, type Recipe } from '../lib/merge';
import { parseIngredients } from '../lib/parse';
import { formatQty, UNITS, unitLabel } from '../lib/units';
import { uid } from '../lib/state';
import { fullLibrary, loadSaved, removeSaved, sameTitle, storeSaved, upsertSaved, type LibraryRecipe } from '../lib/library';

interface Props {
  recipes: Recipe[];
  headcount: number;
  onChange: (r: Recipe[]) => void;
  onHeadcount: (n: number) => void;
  onNext: () => void;
}

export function RecipesPanel({ recipes, headcount, onChange, onHeadcount, onNext }: Props) {
  const patch = (id: string, p: Partial<Recipe>) => onChange(recipes.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (r: Recipe) => {
    if (window.confirm(`Remove "${r.title || 'this recipe'}"?`)) onChange(recipes.filter((x) => x.id !== r.id));
  };
  const addBlank = () =>
    onChange([...recipes, { id: uid(), title: '', servings: 4, text: '', selected: true }]);
  const [saved, setSaved] = useState<LibraryRecipe[]>(loadSaved);
  const [pickerOpen, setPickerOpen] = useState(true);
  const library = fullLibrary(saved);
  const updateSaved = (next: LibraryRecipe[]) => {
    setSaved(next);
    storeSaved(next);
  };
  const inDinner = (title: string) => recipes.find((r) => sameTitle(r.title, title));
  const pick = (lib: LibraryRecipe) => {
    const existing = inDinner(lib.title);
    if (existing) patch(existing.id, { selected: !existing.selected });
    else onChange([...recipes, { title: lib.title, servings: lib.servings, text: lib.text, id: uid(), selected: true }]);
  };
  const saveRecipe = (r: Recipe) => updateSaved(upsertSaved(saved, r));
  const isSaved = (r: Recipe) => saved.some((s) => sameTitle(s.title, r.title) && s.text === r.text && s.servings === r.servings);
  const forget = (title: string) => {
    if (window.confirm(`Remove "${title}" from your past recipes on this device?`)) updateSaved(removeSaved(saved, title));
  };

  const selected = recipes.filter((r) => r.selected).length;

  return (
    <section className="panel">
      <div className="card headcount">
        <div>
          <span className="label">Eating tonight</span>
          <p className="hint">Every selected recipe is scaled to feed this many.</p>
        </div>
        <div className="stepper">
          <button className="btn icon" onClick={() => onHeadcount(Math.max(1, headcount - 1))} aria-label="Fewer people">
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={headcount}
            onChange={(e) => onHeadcount(Math.max(1, Math.min(500, Math.round(Number(e.target.value) || 1))))}
            aria-label="Headcount"
          />
          <button className="btn icon" onClick={() => onHeadcount(Math.min(500, headcount + 1))} aria-label="More people">
            +
          </button>
        </div>
      </div>

      <div className="card library">
        <button className="library-head" onClick={() => setPickerOpen((v) => !v)} aria-expanded={pickerOpen}>
          <span>
            <span className="label">Past recipes</span>
            <span className="hint">Pick what we're making from things we've cooked before.</span>
          </span>
          <span className="label">{pickerOpen ? 'hide' : `${library.length} recipes`}</span>
        </button>
        {pickerOpen && (
          <ul className="chips">
            {library.map((lib) => {
              const r = inDinner(lib.title);
              const on = !!r?.selected;
              return (
                <li key={lib.title}>
                  <button className={`chip ${on ? 'on' : ''}`} onClick={() => pick(lib)} aria-pressed={on}>
                    <span className="chip-mark" aria-hidden="true">{on ? '✓' : '+'}</span>
                    {lib.title}
                    <span className="chip-meta">serves {lib.servings}</span>
                  </button>
                  {lib.saved && (
                    <button className="chip-x" onClick={() => forget(lib.title)} aria-label={`Forget ${lib.title}`} title="Forget">
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {recipes.length === 0 && (
        <div className="empty">
          <p>No recipes yet. Pick from past recipes or paste one in.</p>
        </div>
      )}

      {recipes.map((r) => (
        <RecipeCard
          key={r.id}
          recipe={r}
          headcount={headcount}
          onPatch={(p) => patch(r.id, p)}
          onRemove={() => remove(r)}
          onSave={() => saveRecipe(r)}
          saved={isSaved(r)}
        />
      ))}

      <div className="row-actions">
        <button className="btn" onClick={addBlank}>+ Paste a recipe</button>
        <span className="spacer" />
        <button className="btn primary" onClick={onNext} disabled={selected === 0}>
          Grocery list →
        </button>
      </div>
    </section>
  );
}

function RecipeCard({
  recipe: r,
  headcount,
  onPatch,
  onRemove,
  onSave,
  saved,
}: {
  recipe: Recipe;
  headcount: number;
  onPatch: (p: Partial<Recipe>) => void;
  onRemove: () => void;
  onSave: () => void;
  saved: boolean;
}) {
  const [showParsed, setShowParsed] = useState(false);
  const parsed = showParsed ? parseIngredients(r.text) : [];
  const factor = scaleFactor(r.servings, headcount);
  const lineCount = r.text.split('\n').filter((l) => l.trim()).length;

  return (
    <article className={`card recipe ${r.selected ? '' : 'muted'}`}>
      <div className="recipe-head">
        <label className="check">
          <input type="checkbox" checked={r.selected} onChange={(e) => onPatch({ selected: e.target.checked })} />
          <span className="sr-only">Include in grocery list</span>
        </label>
        <input
          className="title-input"
          value={r.title}
          placeholder="Recipe name"
          onChange={(e) => onPatch({ title: e.target.value })}
          aria-label="Recipe name"
        />
        <button className="btn icon ghost" onClick={onRemove} aria-label="Remove recipe" title="Remove">
          ×
        </button>
      </div>
      <div className="recipe-meta">
        <label className="inline">
          <span className="label">Serves</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={r.servings}
            onChange={(e) => onPatch({ servings: Math.max(1, Number(e.target.value) || 1) })}
            className="small-num"
          />
        </label>
        <span className="label scale">×{formatQty(Math.round(factor * 100) / 100)} for {headcount}</span>
        <span className="label">{lineCount} lines</span>
      </div>
      <textarea
        value={r.text}
        onChange={(e) => onPatch({ text: e.target.value })}
        placeholder={'One ingredient per line, e.g.\n2 1/2 cups flour\n3 cloves garlic, minced\n1 (14 oz) can tomatoes\nsalt to taste'}
        rows={Math.min(14, Math.max(5, lineCount + 1))}
        spellCheck={false}
        aria-label="Ingredients"
      />
      <div className="card-links">
        <button className="link-btn" onClick={() => setShowParsed((v) => !v)}>
          {showParsed ? 'Hide' : 'Check'} how it was read
        </button>
        <button className="link-btn" onClick={onSave} disabled={saved || !r.title.trim() || !r.text.trim()}>
          {saved ? 'In past recipes' : 'Save to past recipes'}
        </button>
      </div>
      {showParsed && (
        <table className="parsed">
          <thead>
            <tr>
              <th>qty</th>
              <th>unit</th>
              <th>item</th>
            </tr>
          </thead>
          <tbody>
            {parsed.map((p, i) => (
              <tr key={i} className={p.qty === null ? 'warn' : ''} title={p.raw}>
                <td>
                  {p.qty === null ? '—' : formatQty(p.qty)}
                  {p.qtyMax !== null && `–${formatQty(p.qtyMax)}`}
                </td>
                <td>
                  {p.unit ? unitLabel(UNITS[p.unit], p.qtyMax ?? p.qty ?? 1) : ''}
                  {p.size ? ` (${p.size})` : ''}
                </td>
                <td>
                  {p.name}
                  {p.note && <span className="note">, {p.note}</span>}
                  {p.qty === null && <span className="note"> · to taste</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
