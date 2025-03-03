import { describe, expect, it } from 'vitest';
import { computeBalances, formatDollars, greedySettle, settle, venmoLink, type Person } from './settle';
import { decodeState, encodeState, defaultState, stateFromHash, shareUrl } from './state';

const person = (id: string, paid: number, attended = true, venmo = ''): Person => ({
  id,
  name: id.toUpperCase(),
  venmo,
  attended,
  paid,
});

/** Apply transfers and confirm everyone ends at zero. */
function applyTransfers(nets: { id: string; netCents: number }[], transfers: ReturnType<typeof settle>) {
  const m = new Map(nets.map((n) => [n.id, n.netCents]));
  for (const t of transfers) {
    expect(t.cents).toBeGreaterThan(0);
    m.set(t.from, m.get(t.from)! + t.cents);
    m.set(t.to, m.get(t.to)! - t.cents);
  }
  return [...m.values()];
}

describe('computeBalances', () => {
  it('splits evenly among attendees', () => {
    const b = computeBalances([person('a', 60), person('b', 0), person('c', 0)]);
    expect(b.map((x) => x.shareCents)).toEqual([2000, 2000, 2000]);
    expect(b.map((x) => x.netCents)).toEqual([4000, -2000, -2000]);
  });
  it('distributes leftover cents so shares sum to the total', () => {
    const b = computeBalances([person('a', 10), person('b', 0), person('c', 0)]);
    expect(b.reduce((s, x) => s + x.shareCents, 0)).toBe(1000);
    expect(b.map((x) => x.shareCents)).toEqual([334, 333, 333]);
    expect(b.reduce((s, x) => s + x.netCents, 0)).toBe(0);
  });
  it('reimburses a non-attendee who paid', () => {
    const b = computeBalances([person('a', 30, false), person('b', 0), person('c', 0)]);
    expect(b.map((x) => x.netCents)).toEqual([3000, -1500, -1500]);
  });
  it('handles floating-point dollar inputs exactly', () => {
    const b = computeBalances([person('a', 0.1), person('b', 0.2)]);
    expect(b.map((x) => x.paidCents)).toEqual([10, 20]);
    expect(b.reduce((s, x) => s + x.netCents, 0)).toBe(0);
  });
  it('ignores negative / NaN payments', () => {
    const b = computeBalances([person('a', -5), person('b', NaN)]);
    expect(b.every((x) => x.netCents === 0)).toBe(true);
  });
});

describe('settle', () => {
  it('returns nothing when everyone is even', () => {
    expect(settle([{ id: 'a', netCents: 0 }])).toEqual([]);
  });
  it('one payer, three eaters -> three transfers', () => {
    const b = computeBalances([person('a', 80), person('b', 0), person('c', 0), person('d', 0)]);
    const t = settle(b);
    expect(t).toHaveLength(3);
    expect(t.every((x) => x.to === 'a' && x.cents === 2000)).toBe(true);
  });
  it('matches the max creditor with the max debtor', () => {
    const t = greedySettle([
      { id: 'a', netCents: 5000 },
      { id: 'b', netCents: 1000 },
      { id: 'c', netCents: -4000 },
      { id: 'd', netCents: -2000 },
    ]);
    expect(t[0]).toEqual({ from: 'c', to: 'a', cents: 4000 });
    expect(applyTransfers(
      [
        { id: 'a', netCents: 5000 },
        { id: 'b', netCents: 1000 },
        { id: 'c', netCents: -4000 },
        { id: 'd', netCents: -2000 },
      ],
      t,
    ).every((v) => v === 0)).toBe(true);
  });
  it('finds fewer transfers than greedy when zero-sum subgroups exist', () => {
    // Greedy: a<-e 6, then b<-f... uses 4 transfers. Optimal pairs (a,d),(b,c?)...
    const nets = [
      { id: 'a', netCents: 600 },
      { id: 'b', netCents: 500 },
      { id: 'c', netCents: 400 },
      { id: 'd', netCents: -500 },
      { id: 'e', netCents: -500 },
      { id: 'f', netCents: -500 },
    ];
    const g = greedySettle(nets);
    const best = settle(nets);
    expect(best.length).toBeLessThanOrEqual(g.length);
    // b/d is a zero-sum pair and {a, c, e, f} is zero-sum -> 1 + 3 = 4 transfers minimum
    expect(best).toHaveLength(4);
    expect(applyTransfers(nets, best).every((v) => v === 0)).toBe(true);
  });
  it('pairs up exact matches', () => {
    const nets = [
      { id: 'a', netCents: 700 },
      { id: 'b', netCents: 300 },
      { id: 'c', netCents: -300 },
      { id: 'd', netCents: -700 },
    ];
    const t = settle(nets);
    expect(t).toHaveLength(2);
    expect(applyTransfers(nets, t).every((v) => v === 0)).toBe(true);
  });
  it('always zeroes everyone out on random inputs, never worse than greedy', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let trial = 0; trial < 200; trial++) {
      const people = Array.from({ length: 2 + Math.floor(rand() * 8) }, (_, i) =>
        person(`p${i}`, rand() < 0.5 ? Math.round(rand() * 10000) / 100 : 0, rand() < 0.9),
      );
      const b = computeBalances(people);
      const t = settle(b);
      expect(applyTransfers(b, t).every((v) => v === 0)).toBe(true);
      expect(t.length).toBeLessThanOrEqual(greedySettle(b).length);
      const nonZero = b.filter((x) => x.netCents !== 0).length;
      expect(t.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));
    }
  });
});

describe('formatting + links', () => {
  it('formats dollars', () => {
    expect(formatDollars(1234)).toBe('$12.34');
    expect(formatDollars(-5)).toBe('-$0.05');
  });
  it('builds a Venmo pay link only with a handle', () => {
    expect(venmoLink('', 1000, 'x')).toBeNull();
    expect(venmoLink('@allen-liu', 1250, 'Friday dinner groceries')).toBe(
      'https://venmo.com/?txn=pay&recipients=allen-liu&amount=12.50&note=Friday%20dinner%20groceries',
    );
  });
});

describe('share state', () => {
  it('round-trips through the URL hash', () => {
    const s = defaultState();
    s.people[0].paid = 42.5;
    s.checked = ['garlic'];
    const url = shareUrl(s, 'http://localhost/#old');
    expect(url.startsWith('http://localhost/#d=')).toBe(true);
    const back = stateFromHash(url.slice(url.indexOf('#')))!;
    expect(back.people[0].paid).toBe(42.5);
    expect(back.recipes).toHaveLength(s.recipes.length);
    expect(back.checked).toEqual([]);
    expect(decodeState(encodeState(s))!.headcount).toBe(s.headcount);
  });
  it('rejects garbage', () => {
    expect(decodeState('not-valid')).toBeNull();
    expect(stateFromHash('#nothing')).toBeNull();
  });
});
