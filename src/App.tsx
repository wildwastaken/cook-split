import { useEffect, useMemo, useState } from 'react';
import { RecipesPanel } from './components/RecipesPanel';
import { GroceryPanel } from './components/GroceryPanel';
import { SplitPanel } from './components/SplitPanel';
import { buildGroceryList } from './lib/merge';
import { copyText } from './lib/clipboard';
import { defaultState, loadLocal, saveLocal, shareUrl, stateFromHash, type DinnerState } from './lib/state';

type Tab = 'recipes' | 'groceries' | 'split';
const TABS: { id: Tab; label: string; num: string }[] = [
  { id: 'recipes', label: 'Recipes', num: '01' },
  { id: 'groceries', label: 'Groceries', num: '02' },
  { id: 'split', label: 'Split', num: '03' },
];

function initialState(): { state: DinnerState; fromLink: boolean } {
  const shared = typeof window !== 'undefined' ? stateFromHash(window.location.hash) : null;
  if (shared) return { state: shared, fromLink: true };
  return { state: loadLocal() ?? defaultState(), fromLink: false };
}

export default function App() {
  const [{ state: init, fromLink }] = useState(initialState);
  const [state, setState] = useState<DinnerState>(init);
  const [tab, setTab] = useState<Tab>('recipes');
  const [toast, setToast] = useState<string | null>(fromLink ? 'Opened a shared dinner.' : null);

  useEffect(() => {
    saveLocal(state);
  }, [state]);

  // Once a shared link is loaded, drop the hash so later edits aren't overwritten on refresh.
  useEffect(() => {
    if (fromLink) {
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {
        /* ignore */
      }
    }
  }, [fromLink]);

  // A share link pasted into an already-open tab only changes the hash.
  useEffect(() => {
    const onHash = () => {
      const shared = stateFromHash(window.location.hash);
      if (!shared) return;
      setState(shared);
      setTab('recipes');
      setToast('Opened a shared dinner.');
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const items = useMemo(() => buildGroceryList(state.recipes, state.headcount), [state.recipes, state.headcount]);
  const update = (patch: Partial<DinnerState>) => setState((s) => ({ ...s, ...patch }));

  const share = async () => {
    const url = shareUrl(state, window.location.href);
    const ok = await copyText(url);
    if (ok) setToast('Share link copied. Send it to the group chat.');
    else window.prompt('Copy this link:', url);
  };

  const reset = () => {
    if (window.confirm('Start a new dinner? This clears recipes, people and payments on this device.')) {
      setState(defaultState());
      setTab('recipes');
    }
  };

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-row">
          <div>
            <p className="eyebrow">group cooking splitter</p>
            <h1>Cook Split</h1>
          </div>
          <div className="masthead-actions no-print">
            <button className="btn" onClick={share}>Share link</button>
            <button className="btn ghost" onClick={reset}>New</button>
          </div>
        </div>
        <label className="dinner-name">
          <span className="label">Dinner</span>
          <input
            value={state.dinnerName}
            onChange={(e) => update({ dinnerName: e.target.value })}
            placeholder="Friday dinner"
            aria-label="Dinner name"
          />
        </label>
      </header>

      <nav className="tabs no-print" aria-label="Steps">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <span className="tab-num">{t.num}</span>
            {t.label}
            {t.id === 'groceries' && items.length > 0 && <span className="pill">{items.length}</span>}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'recipes' && (
          <RecipesPanel
            recipes={state.recipes}
            headcount={state.headcount}
            onChange={(recipes) => update({ recipes })}
            onHeadcount={(headcount) => update({ headcount })}
            onNext={() => setTab('groceries')}
          />
        )}
        {tab === 'groceries' && (
          <GroceryPanel
            items={items}
            dinnerName={state.dinnerName}
            headcount={state.headcount}
            checked={state.checked}
            onChecked={(checked) => update({ checked })}
            onToast={setToast}
            onNext={() => setTab('split')}
          />
        )}
        {tab === 'split' && (
          <SplitPanel
            people={state.people}
            dinnerName={state.dinnerName}
            onChange={(people) => update({ people })}
            onToast={setToast}
          />
        )}
      </main>

      <footer className="footer no-print">
        <span className="label">saved on this device · share link carries everything</span>
      </footer>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
