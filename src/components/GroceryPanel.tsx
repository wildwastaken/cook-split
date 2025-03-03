import { groceryListText, groupBySection, itemAmountText, type GroceryItem } from '../lib/merge';
import { copyText } from '../lib/clipboard';

interface Props {
  items: GroceryItem[];
  dinnerName: string;
  headcount: number;
  checked: string[];
  onChecked: (c: string[]) => void;
  onToast: (t: string) => void;
  onNext: () => void;
}

export function GroceryPanel({ items, dinnerName, headcount, checked, onChecked, onToast, onNext }: Props) {
  const groups = groupBySection(items);
  const checkedSet = new Set(checked);
  const done = items.filter((i) => checkedSet.has(i.key)).length;

  const toggle = (key: string) =>
    onChecked(checkedSet.has(key) ? checked.filter((k) => k !== key) : [...checked, key]);

  const copy = async () => {
    const text = `${dinnerName} - groceries for ${headcount}\n\n${groceryListText(items)}`;
    if (await copyText(text)) onToast('Grocery list copied.');
    else window.prompt('Copy the list:', text);
  };

  if (items.length === 0) {
    return (
      <section className="panel">
        <div className="empty">
          <p>Nothing to buy yet. Select or paste a recipe first.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel grocery">
      <div className="print-title">
        <h2>{dinnerName}</h2>
        <p className="label">groceries for {headcount}</p>
      </div>

      <div className="row-actions no-print">
        <span className="label">
          {done}/{items.length} in the cart
        </span>
        <span className="spacer" />
        <button className="btn ghost" onClick={() => onChecked([])} disabled={done === 0}>
          Uncheck all
        </button>
        <button className="btn" onClick={copy}>Copy text</button>
        <button className="btn" onClick={() => window.print()}>Print</button>
      </div>

      {groups.map((g) => (
        <div className="card section" key={g.section}>
          <h3 className="section-title">
            <span className="label">{g.section}</span>
          </h3>
          <ul className="items">
            {g.items.map((item) => {
              const isChecked = checkedSet.has(item.key);
              return (
                <li key={item.key} className={isChecked ? 'done' : ''}>
                  <label>
                    <input type="checkbox" checked={isChecked} onChange={() => toggle(item.key)} />
                    <span className="box" aria-hidden="true" />
                    <span className="item-text">
                      <span className="amount">{item.amounts.length ? itemAmountText(item) : ''}</span>{' '}
                      <span className="item-name">{item.name}</span>
                      {item.amounts.length === 0 && <span className="note"> · to taste</span>}
                      {item.amounts.length > 0 && item.alsoToTaste && <span className="note"> · plus extra to taste</span>}
                      <span className="sources">{item.sources.join(' · ')}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <p className="hint no-print">
        Amounts are rounded up to shopper-friendly sizes. Volume and weight are never converted into each other.
      </p>

      <div className="row-actions no-print">
        <span className="spacer" />
        <button className="btn primary" onClick={onNext}>
          Split the bill →
        </button>
      </div>
    </section>
  );
}
