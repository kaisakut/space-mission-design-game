import { useMemo, useState } from 'react';
import { MISSIONS, UPCOMING } from '../data/missions';
import type { Mission } from '../data/types';
import { runForecast } from '../engine/forecast';
import { fmt, tk, useLang } from '../i18n';
import { useCauseName } from './labels';
import { TitleGlobe } from './MissionView';

/** Line art for each destination (the moon and Jupiter get their own 3D views in a later step). */
function MissionArt({ id }: { id: string }) {
  const ring = <ellipse cx="50" cy="30" rx="38" ry="9" fill="none" stroke="#9fd8ff" strokeWidth="1" strokeDasharray="3 2" />;
  return (
    <svg className="mission-art" viewBox="0 0 100 60" aria-hidden="true">
      {id === 'wildfire-cubesat' && <><circle cx="50" cy="30" r="20" fill="#173a6b" stroke="#4a78b8" /><path d="M36 24q8-6 14 0t14 2M38 36q6 4 12 0t10 2" fill="none" stroke="#3f7a4a" strokeWidth="2" />{[[42, 27], [55, 33], [47, 37]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.6" fill="#ff7a3a" />)}{ring}<rect x="84" y="27" width="5" height="5" fill="#cfd8e8" /></>}
      {id === 'lunar-ice-rover' && <><circle cx="50" cy="62" r="40" fill="#2a2f3c" stroke="#8a93a8" />{[[34, 30, 4], [56, 27, 3], [68, 36, 5]].map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={r} fill="none" stroke="#6b7488" />)}<path d="M46 22h10l2 4h-14z" fill="#cfd8e8" /><circle cx="47" cy="27" r="1.5" fill="#cfd8e8" /><circle cx="55" cy="27" r="1.5" fill="#cfd8e8" /><path d="M51 22v-5l4-2" stroke="#cfd8e8" fill="none" /><circle cx="18" cy="10" r="5" fill="#1d3f74" stroke="#4a78b8" /></>}
      {id === 'jupiter-icy-moon' && <><circle cx="30" cy="32" r="22" fill="#3a2d22" stroke="#c9a27a" /><path d="M9 26h42M8 34h44M11 41h38" stroke="#a07a58" strokeWidth="2" /><ellipse cx="38" cy="38" rx="4" ry="2" fill="#b5583a" /><path d="M30 32Q60 0 82 30Q60 58 30 32" fill="none" stroke="#9fd8ff" strokeWidth="1" strokeDasharray="3 2" /><circle cx="74" cy="18" r="5" fill="#cdbfa8" stroke="#8a7a60" /><rect x="80" y="28" width="4" height="4" fill="#cfd8e8" /></>}
    </svg>
  );
}

/** A mission card: where it goes, how the standard design fares, and its two biggest weak points. */
function MissionCard({ m, onStart }: { m: Mission; onStart: () => void }) {
  const { t, L } = useLang();
  const causeName = useCauseName(m);
  const f = useMemo(() => runForecast(m, {}, 20261114, 1, 100, { stream: 'title' }), [m]);
  const share = Math.round(f.successShare * 100);
  const r = 15, c = 2 * Math.PI * r;
  return (
    <div className={`mission mission-${m.id}`}>
      <MissionArt id={m.id} />
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
      <div className="title-hero">
        <TitleGlobe mission={MISSIONS[0]!} />
        <div>
          <p className="tagline">{t.tagline}</p>
          <ol className="flow" aria-label={t.flowLabel}>
            {[t.flow1, t.flow2, t.flow3, t.flow4].map((x, i) => <li key={x}><span className="flow-n">{i + 1}</span>{x}</li>)}
          </ol>
        </div>
      </div>
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
