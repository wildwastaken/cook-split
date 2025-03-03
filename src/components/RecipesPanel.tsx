import { useState } from 'react';
import { scaleFactor, type Recipe } from '../lib/merge';
import { parseIngredients } from '../lib/parse';
import { formatQty, UNITS, unitLabel } from '../lib/units';
import { uid } from '../lib/state';
import { SAMPLE_RECIPES } from '../samples';

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
  const missingSamples = SAMPLE_RECIPES.filter((s) => !recipes.some((r) => r.title === s.title));
  const addSamples = () =>
    onChange([...recipes, ...missingSamples.map((s) => ({ ...s, id: uid(), selected: true }))]);

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

      {recipes.length === 0 && (
        <div className="empty">
          <p>No recipes yet. Paste one in or start from the samples.</p>
        </div>
      )}

      {recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} headcount={headcount} onPatch={(p) => patch(r.id, p)} onRemove={() => remove(r)} />
      ))}

      <div className="row-actions">
        <button className="btn" onClick={addBlank}>+ Paste a recipe</button>
        {missingSamples.length > 0 && (
          <button className="btn ghost" onClick={addSamples}>
            Add {missingSamples.length} sample{missingSamples.length > 1 ? 's' : ''}
          </button>
        )}
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
}: {
  recipe: Recipe;
  headcount: number;
  onPatch: (p: Partial<Recipe>) => void;
  onRemove: () => void;
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
      <button className="link-btn" onClick={() => setShowParsed((v) => !v)}>
        {showParsed ? 'Hide' : 'Check'} how it was read
      </button>
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
