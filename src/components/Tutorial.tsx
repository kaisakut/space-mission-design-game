import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { tk, useLang } from '../i18n';

/**
 * Steps of the first-time guide. Each points at a part of the screen marked with data-tour; the rest is dimmed.
 * A step with `act` waits for the player to do it (a click inside the target that matches the selector).
 */
interface Step { target: string | null; key: string; act?: string; needs?: string }
const STEPS: Step[] = [
  { target: 'view', key: 'tourView', needs: '[data-tour="view"]' },
  { target: 'forecast', key: 'tourBaseline' },
  { target: 'weak', key: 'tourWeak', act: '.link-btn', needs: '[data-tour="weak"] .link-btn' },
  { target: 'options', key: 'tourPick', act: '.opt input' },
  // Rewritten below when the open item is the last one (there is no "Next item" then).
  { target: 'nextItem folded', key: 'tourNextItem', act: '[data-tour="nextItem"], [data-tour="folded"]' },
  { target: 'forecastBtn', key: 'tourRun', act: 'button' },
  { target: 'confirm', key: 'tourConfirm' },
];

/** Every element a step points at (a step can name several, e.g. the "Next item" button and the folded rows). */
const targets = (target: string | null) => (target ? target.split(' ').flatMap((x) => [...document.querySelectorAll(`[data-tour="${x}"]`)]) : []);

/** A short hands-on walk through one turn, after the mission briefing dialog. "Skip guide" works at any time. */
export function Tutorial({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const steps = STEPS;
  const [i, setI] = useState(0);
  // The "Next item" step on the last open item asks for nothing: it only points at the folded rows.
  const [lastItem, setLastItem] = useState(false);
  useLayoutEffect(() => { if (steps[i]!.key === 'tourNextItem') setLastItem(!document.querySelector('[data-tour="nextItem"]')); }, [i, steps]);
  const step: Step = steps[i]!.key === 'tourNextItem' && lastItem ? { target: 'folded', key: 'tourFolded' } : steps[i]!;
  // Decided once, so the numbering counts only the steps this guide will show (1/6 … 6/6, no gaps).
  const [shown] = useState(() => steps.map((x) => !x.needs || !!document.querySelector(x.needs)));
  const ok = (k: number) => shown[k]!;
  const pos = shown.slice(0, i).filter(Boolean).length + 1, total = shown.filter(Boolean).length;
  const after = (k: number, dir: 1 | -1) => { let j = k + dir; while (j >= 0 && j < steps.length && !ok(j)) j += dir; return j; };
  const last = after(i, 1) >= steps.length;
  const next = () => (last ? onClose() : setI(after(i, 1)));
  // The guide box sits at the bottom of the middle column (its lower half is free), not over the side columns.
  const [spot, setSpot] = useState<CSSProperties>({});
  useEffect(() => {
    const read = () => {
      const c = document.querySelector('.col-center')?.getBoundingClientRect();
      if (c) setSpot({ left: c.left + c.width / 2, right: 'auto', bottom: window.innerHeight - c.bottom + 12, transform: 'translateX(-50%)', maxWidth: Math.min(c.width - 16, 30 * 16), minWidth: 0 });
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  // The hole in the dimmed screen covers everything the step points at (it can move when the layout changes).
  const [hole, setHole] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!step.target) { setHole(null); return; }
    const read = () => {
      const rs = targets(step.target).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
      if (!rs.length) { setHole(null); return; }
      const l = Math.min(...rs.map((r) => r.left)), tp = Math.min(...rs.map((r) => r.top));
      setHole(new DOMRect(l, tp, Math.max(...rs.map((r) => r.right)) - l, Math.max(...rs.map((r) => r.bottom)) - tp));
    };
    read();
    const id = window.setInterval(read, 250);
    window.addEventListener('resize', read);
    return () => { clearInterval(id); window.removeEventListener('resize', read); };
  }, [step.target]);

  useEffect(() => {
    // The forecast step is done already if this phase's forecast has been used.
    if (step.key === 'tourRun' && (document.querySelector('[data-tour="forecastBtn"]') as HTMLButtonElement | null)?.disabled) { next(); return; }
    const els = targets(step.target);
    if (!els.length) return;
    els.forEach((el) => el.classList.add('tour-on'));
    els[0]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Steps that ask for an action move on by themselves once it is done.
    const onClick = (e: Event) => {
      const hit = step.act && (e.target as Element).closest?.(step.act);
      if (hit && els.some((el) => el.contains(hit))) window.setTimeout(next, 250);
    };
    document.addEventListener('click', onClick, true);
    return () => { els.forEach((el) => el.classList.remove('tour-on')); document.removeEventListener('click', onClick, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, lastItem]);

  return (
    <>
      {hole ? (
        <>
          {/* Four dim panels around the target: only the target can be clicked. */}
          <div className="tour-block" style={{ left: 0, top: 0, width: '100%', height: Math.max(0, hole.top - 4) }} />
          <div className="tour-block" style={{ left: 0, top: hole.bottom + 4, width: '100%', bottom: 0 }} />
          <div className="tour-block" style={{ left: 0, top: hole.top - 4, width: Math.max(0, hole.left - 4), height: hole.height + 8 }} />
          <div className="tour-block" style={{ left: hole.right + 4, top: hole.top - 4, right: 0, height: hole.height + 8 }} />
        </>
      ) : <div className="tour-block" style={{ inset: 0 }} />}
      <div className="tour" role="dialog" aria-label={t.tourTitle} style={spot}>
        <div className="tour-head"><b>{t.tourTitle}</b><span className="note">{pos} / {total}</span></div>
        <p>{tk(t, step.key)}</p>
        {step.act && <p className="note small">{t.tourDoIt}</p>}
        <div className="tour-actions">
          <button type="button" className="link-btn tour-close" onClick={onClose}>{t.tourSkip}</button>
          <span>
            {i > 0 && <button type="button" className="secondary" onClick={() => setI(Math.max(0, after(i, -1)))}>{t.tourBack}</button>}
            <button type="button" className={step.act ? 'secondary' : 'primary'} onClick={next}>
              {last ? t.tourDone : step.act ? t.tourSkipStep : t.tourNext}
            </button>
          </span>
        </div>
      </div>
    </>
  );
}
