import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Option boxes in two columns whose heights come out about even: boxes are measured, then the tallest first goes
 * to the shorter column (each column keeps the boxes in their usual order). One column when there is no room for two.
 */
export function SlotColumns({ items }: { items: { id: string; node: ReactNode }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<{ two: boolean; left: string[] } | null>(null);
  const [tick, setTick] = useState(0);
  const ids = items.map((i) => i.id);
  const key = ids.join('|');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const em = parseFloat(getComputedStyle(el).fontSize) || 14;
    const two = items.length > 1 && el.clientWidth >= em * 35;
    let left = ids;
    if (two) {
      const h = new Map<string, number>();
      el.querySelectorAll<HTMLElement>('[data-slot]').forEach((e) => h.set(e.dataset.slot!, e.getBoundingClientRect().height + em));
      if (h.size === ids.length) {
        const tot = [0, 0];
        const side = new Map<string, number>();
        for (const id of [...ids].sort((a, b) => h.get(b)! - h.get(a)!)) {
          const c = tot[0]! <= tot[1]! ? 0 : 1;
          side.set(id, c); tot[c] += h.get(id)!;
        }
        // The column holding the first box goes on the left.
        const first = side.get(ids[0]!)!;
        left = ids.filter((id) => side.get(id) === first);
      } else left = ids.filter((_, i) => i % 2 === 0);
    }
    if (!plan || plan.two !== two || plan.left.join('|') !== left.join('|')) setPlan({ two, left });
  });
  // Measure again when the column changes width, or when the boxes change.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) > 1) { w = el.clientWidth; setTick((x) => x + 1); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  void tick;

  const two = plan ? plan.two : items.length > 1;
  const left = plan && plan.left.every((id) => ids.includes(id)) ? plan.left : ids.filter((_, i) => i % 2 === 0);
  const cell = (i: { id: string; node: ReactNode }) => <div key={i.id} data-slot={i.id} className="slot-cell">{i.node}</div>;
  return (
    <div ref={ref} className={`slot-cols ${two ? 'two' : 'one'}`} data-key={key}>
      {two ? <>
        <div className="slot-col">{items.filter((i) => left.includes(i.id)).map(cell)}</div>
        <div className="slot-col">{items.filter((i) => !left.includes(i.id)).map(cell)}</div>
      </> : <div className="slot-col">{items.map(cell)}</div>}
    </div>
  );
}
