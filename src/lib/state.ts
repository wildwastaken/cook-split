import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Recipe } from './merge';
import type { Person } from './settle';
import { SAMPLE_RECIPES } from '../samples';

export interface DinnerState {
  v: 1;
  dinnerName: string;
  headcount: number;
  recipes: Recipe[];
  people: Person[];
  /** Grocery item keys checked off while shopping. */
  checked: string[];
}

export const STORAGE_KEY = 'cook-split:v1';

export const uid = (): string => Math.random().toString(36).slice(2, 10);

export function defaultState(): DinnerState {
  return {
    v: 1,
    dinnerName: 'Friday dinner',
    headcount: 6,
    recipes: SAMPLE_RECIPES.map((r, i) => ({ ...r, id: uid(), selected: i < 2 })),
    people: [
      { id: uid(), name: 'Allen', venmo: '', attended: true, paid: 0 },
      { id: uid(), name: '', venmo: '', attended: true, paid: 0 },
    ],
    checked: [],
  };
}

const num = (x: unknown, fallback: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
const str = (x: unknown, fallback = ''): string => (typeof x === 'string' ? x : fallback);

/** Validate/repair untrusted state (from localStorage or a shared link). */
export function sanitize(input: unknown): DinnerState | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (!Array.isArray(o.recipes) || !Array.isArray(o.people)) return null;
  return {
    v: 1,
    dinnerName: str(o.dinnerName, 'Dinner').slice(0, 120),
    headcount: Math.min(500, Math.max(1, Math.round(num(o.headcount, 4)))),
    recipes: o.recipes.slice(0, 50).map((r: Record<string, unknown>) => ({
      id: str(r?.id) || uid(),
      title: str(r?.title, 'Recipe').slice(0, 120),
      servings: Math.max(1, num(r?.servings, 4)),
      text: str(r?.text).slice(0, 20000),
      selected: r?.selected !== false,
    })),
    people: o.people.slice(0, 50).map((p: Record<string, unknown>) => ({
      id: str(p?.id) || uid(),
      name: str(p?.name).slice(0, 60),
      venmo: str(p?.venmo).slice(0, 60),
      attended: p?.attended !== false,
      paid: Math.max(0, num(p?.paid, 0)),
    })),
    checked: Array.isArray(o.checked) ? o.checked.filter((c): c is string => typeof c === 'string') : [],
  };
}

export function loadLocal(): DinnerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocal(state: DinnerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / disabled: ignore */
  }
}

/** Encode state into a URL-hash-safe compressed string. Checked-off items are not shared. */
export function encodeState(state: DinnerState): string {
  return compressToEncodedURIComponent(JSON.stringify({ ...state, checked: [] }));
}

export function decodeState(encoded: string): DinnerState | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    return json ? sanitize(JSON.parse(json)) : null;
  } catch {
    return null;
  }
}

/** Read "#d=<payload>" from a hash string. */
export function stateFromHash(hash: string): DinnerState | null {
  const m = hash.match(/[#&]d=([^&]+)/);
  return m ? decodeState(m[1]) : null;
}

export function shareUrl(state: DinnerState, base: string): string {
  return `${base.split('#')[0]}#d=${encodeState(state)}`;
}
