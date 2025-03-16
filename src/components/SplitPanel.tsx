import { useMemo } from 'react';
import { computeBalances, formatDollars, settle, toCents, venmoLink, type Person, type PersonalItem } from '../lib/settle';
import { uid } from '../lib/state';
import { copyText } from '../lib/clipboard';

interface Props {
  people: Person[];
  personal: PersonalItem[];
  dinnerName: string;
  onChange: (p: Person[]) => void;
  onPersonal: (p: PersonalItem[]) => void;
  onToast: (t: string) => void;
}

export function SplitPanel({ people, personal, dinnerName, onChange, onPersonal, onToast }: Props) {
  const patchItem = (id: string, p: Partial<PersonalItem>) => onPersonal(personal.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const addItem = () => onPersonal([...personal, { id: uid(), name: '', cost: 0, by: people[0]?.id ?? '' }]);
  const removeItem = (id: string) => onPersonal(personal.filter((x) => x.id !== id));
  const patch = (id: string, p: Partial<Person>) => onChange(people.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const add = () => onChange([...people, { id: uid(), name: '', venmo: '', attended: true, paid: 0 }]);
  const remove = (id: string) => onChange(people.filter((p) => p.id !== id));

  const balances = useMemo(() => computeBalances(people, personal), [people, personal]);
  const transfers = useMemo(() => settle(balances), [balances]);
  const byId = new Map(people.map((p) => [p.id, p]));
  const nameOf = (id: string) => byId.get(id)?.name.trim() || 'Someone';
  const receipts = people.reduce((s, p) => s + toCents(p.paid), 0);
  const total = balances.reduce((s, b) => s + b.paidCents, 0); // shared part only
  const soloTotal = receipts - total;
  const overClaimed = balances.filter((b) => {
    const claimed = personal.filter((it) => it.by === b.id).reduce((s, it) => s + toCents(it.cost), 0);
    return claimed > toCents(people.find((p) => p.id === b.id)?.paid ?? 0);
  });
  const attendees = people.filter((p) => p.attended).length;
  const note = `${dinnerName.trim() || 'Dinner'} groceries`;

  const summary = () =>
    [
      `${note}: ${formatDollars(total)} split${soloTotal > 0 ? ` (${formatDollars(soloTotal)} not split)` : ''}, ${attendees} eating, ${formatDollars(attendees ? Math.round(total / attendees) : 0)} each`,
      ...transfers.map((t) => {
        const link = venmoLink(byId.get(t.to)?.venmo ?? '', t.cents, note);
        return `${nameOf(t.from)} → ${nameOf(t.to)}: ${formatDollars(t.cents)}${link ? `  ${link}` : ''}`;
      }),
    ].join('\n');

  const copy = async () => {
    const s = summary();
    if (await copyText(s)) onToast('Summary copied.');
    else window.prompt('Copy the summary:', s);
  };

  return (
    <section className="panel">
      <div className="card">
        <div className="people-head">
          <span className="label">Who ate, who paid</span>
        </div>
        <ul className="people">
          {people.map((p) => (
            <li key={p.id} className={p.attended ? '' : 'muted'}>
              <label className="check" title="Ate dinner">
                <input type="checkbox" checked={p.attended} onChange={(e) => patch(p.id, { attended: e.target.checked })} />
                <span className="sr-only">Ate dinner</span>
              </label>
              <div className="person-fields">
                <input
                  value={p.name}
                  placeholder="Name"
                  onChange={(e) => patch(p.id, { name: e.target.value })}
                  aria-label="Name"
                />
                <input
                  value={p.venmo}
                  placeholder="@venmo"
                  onChange={(e) => patch(p.id, { venmo: e.target.value.replace(/\s/g, '') })}
                  aria-label="Venmo handle"
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="mono"
                />
                <label className="money">
                  <span aria-hidden="true">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={p.paid || ''}
                    placeholder="0.00"
                    onChange={(e) => patch(p.id, { paid: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label="Amount paid"
                  />
                </label>
              </div>
              <button className="btn icon ghost" onClick={() => remove(p.id)} aria-label="Remove person" title="Remove">
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="row-actions">
          <button className="btn" onClick={add}>+ Add person</button>
          <span className="spacer" />
          <span className="label">checkbox = ate dinner</span>
        </div>
      </div>

      <div className="card">
        <div className="people-head">
          <span className="label">Not split</span>
          <span className="hint">Bought on the same trip but paid for only by whoever bought it.</span>
        </div>
        {personal.length === 0 ? (
          <p className="hint">Nothing yet. Mark items on the grocery list, or add one here.</p>
        ) : (
          <ul className="people solo-items">
            {personal.map((it) => (
              <li key={it.id}>
                <div className="person-fields">
                  <input value={it.name} placeholder="Item" onChange={(e) => patchItem(it.id, { name: e.target.value })} aria-label="Item" />
                  <select value={it.by} onChange={(e) => patchItem(it.id, { by: e.target.value })} aria-label="Bought by">
                    <option value="">who bought it?</option>
                    {people.map((p, i) => (
                      <option key={p.id} value={p.id}>
                        {p.name.trim() || `Person ${i + 1}`}
                      </option>
                    ))}
                  </select>
                  <label className="money">
                    <span aria-hidden="true">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={it.cost || ''}
                      placeholder="0.00"
                      onChange={(e) => patchItem(it.id, { cost: Math.max(0, Number(e.target.value) || 0) })}
                      aria-label="Cost"
                    />
                  </label>
                </div>
                <button className="btn icon ghost" onClick={() => removeItem(it.id)} aria-label="Split it again" title="Split it again">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="row-actions">
          <button className="btn" onClick={addItem}>+ Add item</button>
          <span className="spacer" />
          {soloTotal > 0 && <span className="label">{formatDollars(soloTotal)} taken out of the split</span>}
        </div>
        {personal.some((it) => !it.by && it.cost > 0) && <p className="hint warn">Pick who bought each item, or it stays in the split.</p>}
        {overClaimed.length > 0 && (
          <p className="hint warn">
            {overClaimed.map((b) => b.name.trim() || 'Someone').join(', ')}: not-split items cost more than what they paid. Check the amounts.
          </p>
        )}
      </div>

      <div className="card totals">
        <div>
          <span className="label">{soloTotal > 0 ? 'Split total' : 'Total spent'}</span>
          <strong>{formatDollars(total)}</strong>
        </div>
        <div>
          <span className="label">Eating</span>
          <strong>{attendees}</strong>
        </div>
        <div>
          <span className="label">Each</span>
          <strong>{attendees ? formatDollars(Math.floor(total / attendees)) : '—'}</strong>
        </div>
      </div>

      {attendees === 0 && total > 0 && <p className="hint">Check at least one person who ate.</p>}

      {total > 0 && attendees > 0 && (
        <div className="card">
          <span className="label">Balances</span>
          <ul className="balances">
            {balances.map((b) => (
              <li key={b.id}>
                <span>{b.name.trim() || 'Someone'}</span>
                <span className="mono dim">
                  paid {formatDollars(b.paidCents)}
                  {b.personalCents > 0 && ` (+${formatDollars(b.personalCents)} own)`} · share {formatDollars(b.shareCents)}
                </span>
                <span className={`mono net ${b.netCents > 0 ? 'pos' : b.netCents < 0 ? 'neg' : ''}`}>
                  {b.netCents > 0 ? '+' : ''}
                  {formatDollars(b.netCents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {total > 0 && attendees > 0 && (
        <div className="card settle">
          <span className="label">
            Settle up · {transfers.length} transfer{transfers.length === 1 ? '' : 's'}
          </span>
          {transfers.length === 0 ? (
            <p className="hint">Everyone is even. Nice.</p>
          ) : (
            <ul className="transfers">
              {transfers.map((t, i) => {
                const to = byId.get(t.to);
                const link = venmoLink(to?.venmo ?? '', t.cents, note);
                return (
                  <li key={i}>
                    <span className="who">
                      <strong>{nameOf(t.from)}</strong> pays <strong>{nameOf(t.to)}</strong>
                    </span>
                    <span className="amt mono">{formatDollars(t.cents)}</span>
                    {link ? (
                      <a className="btn venmo" href={link} target="_blank" rel="noopener noreferrer">
                        Venmo @{to!.venmo.replace(/^@/, '')}
                      </a>
                    ) : (
                      <span className="label dim">add {nameOf(t.to)}'s venmo for a link</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="row-actions">
            <span className="spacer" />
            <button className="btn" onClick={copy}>Copy summary</button>
          </div>
        </div>
      )}
    </section>
  );
}
