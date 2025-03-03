/** Expense split + minimum-transfer settlement. All money math is in integer cents. */

export interface Person {
  id: string;
  name: string;
  venmo: string;
  attended: boolean;
  /** Dollars paid at the store. */
  paid: number;
}

export interface Balance {
  id: string;
  name: string;
  paidCents: number;
  shareCents: number;
  /** positive = is owed money, negative = owes money */
  netCents: number;
}

export interface Transfer {
  from: string; // person id
  to: string; // person id
  cents: number;
}

export const toCents = (dollars: number): number =>
  Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;

/**
 * Even split among attendees. Leftover cents (total not divisible by headcount)
 * go one each to the first attendees in list order, so shares sum exactly to the total.
 * Non-attendees who paid get fully reimbursed.
 */
export function computeBalances(people: Person[]): Balance[] {
  const attendees = people.filter((p) => p.attended);
  const totalCents = people.reduce((s, p) => s + toCents(p.paid), 0);
  const n = attendees.length;
  const baseShare = n ? Math.floor(totalCents / n) : 0;
  let remainder = n ? totalCents - baseShare * n : 0;
  return people.map((p) => {
    let share = 0;
    if (p.attended && n) {
      share = baseShare;
      if (remainder > 0) {
        share += 1;
        remainder--;
      }
    }
    const paid = toCents(p.paid);
    return { id: p.id, name: p.name, paidCents: paid, shareCents: share, netCents: n ? paid - share : 0 };
  });
}

/**
 * Greedy settlement: repeatedly match the largest creditor with the largest debtor.
 * Always uses at most (non-zero people - 1) transfers.
 */
export function greedySettle(nets: { id: string; netCents: number }[]): Transfer[] {
  const creditors = nets.filter((b) => b.netCents > 0).map((b) => ({ id: b.id, amt: b.netCents }));
  const debtors = nets.filter((b) => b.netCents < 0).map((b) => ({ id: b.id, amt: -b.netCents }));
  const transfers: Transfer[] = [];
  const byAmt = (a: { amt: number; id: string }, b: { amt: number; id: string }) =>
    b.amt - a.amt || a.id.localeCompare(b.id);
  while (creditors.length && debtors.length) {
    creditors.sort(byAmt);
    debtors.sort(byAmt);
    const c = creditors[0];
    const d = debtors[0];
    const x = Math.min(c.amt, d.amt);
    transfers.push({ from: d.id, to: c.id, cents: x });
    c.amt -= x;
    d.amt -= x;
    if (c.amt === 0) creditors.shift();
    if (d.amt === 0) debtors.shift();
  }
  return transfers;
}

/**
 * Minimum-transfer settlement.
 *
 * The true minimum is (people with non-zero balance) - (max number of disjoint zero-sum groups).
 * For up to 16 non-zero balances we find that grouping exactly with a bitmask DP, then settle each
 * group with the greedy max-creditor/max-debtor rule (size-1 transfers per group).
 * Larger inputs fall back to plain greedy.
 */
export function settle(balances: { id: string; netCents: number }[]): Transfer[] {
  const nz = balances.filter((b) => b.netCents !== 0);
  const n = nz.length;
  if (n === 0) return [];
  if (n > 16) return greedySettle(nz);

  const full = (1 << n) - 1;
  const sum = new Array<number>(full + 1).fill(0);
  for (let m = 1; m <= full; m++) {
    const low = m & -m;
    const i = 31 - Math.clz32(low);
    sum[m] = sum[m ^ low] + nz[i].netCents;
  }
  // dp[m] = max number of zero-sum prefixes over orderings of the elements in m.
  const dp = new Array<number>(full + 1).fill(0);
  for (let m = 1; m <= full; m++) {
    let best = 0;
    for (let i = 0; i < n; i++) if (m & (1 << i)) best = Math.max(best, dp[m ^ (1 << i)]);
    dp[m] = best + (sum[m] === 0 ? 1 : 0);
  }
  // Reconstruct an optimal ordering; zero-sum prefixes delimit the groups.
  const removed: number[] = [];
  let m = full;
  while (m) {
    const bonus = sum[m] === 0 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      if (m & (1 << i) && dp[m ^ (1 << i)] + bonus === dp[m]) {
        removed.push(i);
        m ^= 1 << i;
        break;
      }
    }
  }
  const order = removed.reverse();
  const transfers: Transfer[] = [];
  let group: { id: string; netCents: number }[] = [];
  let running = 0;
  for (const i of order) {
    group.push(nz[i]);
    running += nz[i].netCents;
    if (running === 0) {
      transfers.push(...greedySettle(group));
      group = [];
    }
  }
  if (group.length) transfers.push(...greedySettle(group)); // only if balances don't sum to zero
  return transfers;
}

export function formatDollars(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Venmo "pay" deep link to the person being paid. Returns null if there's no handle. */
export function venmoLink(handle: string, cents: number, note: string): string | null {
  const h = handle.trim().replace(/^@/, '');
  if (!h) return null;
  const amount = (cents / 100).toFixed(2);
  return `https://venmo.com/?txn=pay&recipients=${encodeURIComponent(h)}&amount=${amount}&note=${encodeURIComponent(note)}`;
}
