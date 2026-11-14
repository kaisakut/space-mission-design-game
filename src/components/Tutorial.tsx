import { useEffect, useState } from 'react';
import { tk, useLang } from '../i18n';

/** Steps of the first-time guide: each points at a part of the screen marked with data-tour. */
const STEPS = [
  { target: null, key: 'tour1' },
  { target: 'gauges', key: 'tour2' },
  { target: 'options', key: 'tour3' },
  { target: 'forecast', key: 'tour4' },
  { target: 'confirm', key: 'tour5' },
  { target: 'help', key: 'tour6' },
] as const;

/** A small guide card that walks through one turn; the highlighted part of the screen gets an outline. */
export function Tutorial({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  useEffect(() => {
    if (!step.target) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;
    el.classList.add('tour-on');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return () => el.classList.remove('tour-on');
  }, [step.target]);
  return (
    <div className="tour" role="dialog" aria-label={t.tourTitle}>
      <div className="tour-head"><b>{t.tourTitle}</b><span className="note">{i + 1} / {STEPS.length}</span></div>
      <p>{tk(t, step.key)}</p>
      <div className="tour-actions">
        <button type="button" className="secondary" onClick={onClose}>{t.tourSkip}</button>
        <span>
          {i > 0 && <button type="button" className="secondary" onClick={() => setI(i - 1)}>{t.tourBack}</button>}
          <button type="button" className="primary" onClick={() => (i < STEPS.length - 1 ? setI(i + 1) : onClose())}>{i < STEPS.length - 1 ? t.tourNext : t.tourDone}</button>
        </span>
      </div>
    </div>
  );
}
