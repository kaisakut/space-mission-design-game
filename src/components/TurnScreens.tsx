import { useEffect, useRef, useState } from 'react';
import { play } from '../audio/sfx';
import type { AgencyKind } from '../engine/game';
import { fmt, useLang } from '../i18n';
import { AGENCY_COLOR, useAgencyName } from './labels';
import { AgencyLabel } from './Resolution';

/*
 * Playing together: the screens between turns. None of them shows anything of the game itself, so nobody sees
 * what another person chose before everyone has decided.
 */

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The order of this phase: the name tags shuffle for about a second, then settle in order. */
export function OrderScreen({ phase, order, ais, ready, onGo }: { phase: number; order: AgencyKind[]; ais: AgencyKind[]; ready: boolean; onGo: () => void }) {
  const { t } = useLang();
  const [shown, setShown] = useState<AgencyKind[]>(order);
  const [settled, setSettled] = useState(false);
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!ready) return;
    if (reduced() || order.length < 2) { setShown(order); setSettled(true); return; }
    setSettled(false);
    // Only the display shuffles (Math.random); the order itself comes from the game's own stream.
    const id = window.setInterval(() => { setShown([...order].sort(() => Math.random() - 0.5)); play('tick'); }, 110);
    const stop = window.setTimeout(() => { window.clearInterval(id); setShown(order); setSettled(true); play('rank'); }, 1000);
    return () => { window.clearInterval(id); window.clearTimeout(stop); };
  }, [ready, order]);
  useEffect(() => { if (settled) go.current?.focus(); }, [settled]);
  return (
    <section className="turn-screen order-screen" aria-live="polite">
      <h2>{fmt(t.orderTitle, { n: phase })}</h2>
      <ol className={`order-list ${settled ? 'settled' : ''}`}>
        {shown.map((id, i) => <li key={`${id}-${i}`}><b>{i + 1}</b><AgencyLabel id={id} /></li>)}
      </ol>
      {ais.length > 0 && (
        <div className="order-ai">
          <p className="note">{t.orderAiNote}</p>
          <p>{ais.map((id) => <span key={id} className="order-ai-one"><AgencyLabel id={id} /></span>)}</p>
        </div>
      )}
      <button ref={go} type="button" className="primary" disabled={!settled} onClick={onGo}>{t.orderGo} ▶</button>
    </section>
  );
}

/** "Next is …": the seat's colour, the name large, and nothing else. */
export function HandoverScreen({ id, i, n, onStart }: { id: AgencyKind; i: number; n: number; onStart: () => void }) {
  const { t } = useLang();
  const names = useAgencyName();
  return (
    <section className="turn-screen handover-screen" style={{ ['--seat' as string]: AGENCY_COLOR[id] }}>
      <h2 className="handover-name"><span className="seat-dot big" style={{ background: AGENCY_COLOR[id] }} aria-hidden />{fmt(t.handoverTitle, { name: names.name(id) })}</h2>
      <p className="handover-sub">{fmt(t.handoverSub, { i, n })}</p>
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <button type="button" className="primary" autoFocus onClick={onStart}>{t.handoverStart} ▶</button>
    </section>
  );
}

/** Everyone has decided: gather round. The button waits while the AI agencies decide. */
export function GatherScreen({ ready, onGo }: { ready: boolean; onGo: () => void }) {
  const { t } = useLang();
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (ready) go.current?.focus(); }, [ready]);
  return (
    <section className="turn-screen gather-screen">
      <h2>{t.gatherTitle}</h2>
      <p className="handover-sub">{t.gatherSub}</p>
      {!ready && <p className="note">{t.aiDeciding}</p>}
      <button ref={go} type="button" className="primary" disabled={!ready} onClick={onGo}>{t.gatherStart} ▶</button>
    </section>
  );
}
