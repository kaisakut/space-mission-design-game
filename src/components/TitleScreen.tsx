import { useMemo, useState } from 'react';
import { MISSIONS, UPCOMING } from '../data/missions';
import type { Mission } from '../data/types';
import { runForecast } from '../engine/forecast';
import { fmt, tk, useLang } from '../i18n';
import { useCauseName } from './labels';

/** A mission card: where it goes, how the standard design fares, and its two biggest weak points. */
function MissionCard({ m, onStart }: { m: Mission; onStart: () => void }) {
  const { t, L } = useLang();
  const causeName = useCauseName(m);
  const f = useMemo(() => runForecast(m, {}, 20261114, 1, 100, { stream: 'title' }), [m]);
  const share = Math.round(f.successShare * 100);
  const r = 15, c = 2 * Math.PI * r;
  return (
    <div className={`mission mission-${m.id}`}>
      <span className={`diff diff-${m.difficulty}`}>{tk(t, `diff_${m.difficulty}`)}</span>
      <h3>{L(m.name)}</h3>
      <p>{L(m.summary)}</p>
      <div className="mission-stat">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r={r} fill="none" stroke="#1b2540" strokeWidth="5" />
          <circle cx="20" cy="20" r={r} fill="none" stroke={share >= 70 ? '#4caf50' : share >= 40 ? '#ffb300' : '#ef5350'} strokeWidth="5" strokeDasharray={`${(c * share) / 100} ${c}`} transform="rotate(-90 20 20)" strokeLinecap="round" />
        </svg>
        <div>
          <b>{fmt(t.missionStandard, { n: share })}</b>
          {f.topCauses.length > 0 && <div className="note small">{fmt(t.missionWeak, { x: f.topCauses.slice(0, 2).map(([k]) => causeName(k)).join(t.listSep) })}</div>}
        </div>
      </div>
      <div className="mission-actions">
        <button type="button" className="primary" onClick={onStart}>{t.startMission} ▶</button>
      </div>
    </div>
  );
}

/** First screen: what the game is, how a turn works, and the missions to choose from. */
export function TitleScreen({ onStart, onLibrary }: { onStart: (m: Mission, tutorial: boolean) => void; onLibrary: () => void }) {
  const { t, L } = useLang();
  const [guide, setGuide] = useState(true);
  return (
    <section className="title">
      <p className="tagline">{t.tagline}</p>
      <ol className="flow" aria-label={t.howto2}>
        {[t.flow1, t.flow2, t.flow3, t.flow4].map((x, i) => <li key={x}><span className="flow-n">{i + 1}</span>{x}</li>)}
      </ol>
      <ol className="howto">
        <li>{t.howto1}</li>
        <li>{t.howto2}</li>
        <li>{t.howto3}</li>
      </ol>
      <div className="title-row">
        <h2>{t.chooseMission}</h2>
        <span className="title-tools">
          <label className="practice"><input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} />{t.showGuide}</label>
          <button type="button" className="secondary" onClick={onLibrary}>{t.libraryOpen}</button>
        </span>
      </div>
      <p className="note small">{t.autoPlanNote}</p>
      <div className="missions">
        {MISSIONS.map((m) => <MissionCard key={m.id} m={m} onStart={() => onStart(m, guide)} />)}
        {UPCOMING.map((m) => (
          <div key={m.id} className="mission soon">
            <span className={`diff diff-${m.difficulty}`}>{tk(t, `diff_${m.difficulty}`)}</span>
            <h3>{L(m.name)}</h3>
            <p>{L(m.summary)}</p>
            <span className="note">{t.comingSoonMission}</span>
          </div>
        ))}
      </div>
      <p className="note small">{t.dataNote}</p>
    </section>
  );
}
