import { useMemo, useState } from 'react';
import { MISSIONS, UPCOMING } from '../data/missions';
import type { Mission } from '../data/types';
import { FORECAST_SEED, runForecast } from '../engine/forecast';
import type { AgencyKind, Control, SeatSetup } from '../engine/game';
import { AGENCIES } from '../engine/game';
import { RUNS } from './ForecastPanel';
import { fmt, tk, useLang } from '../i18n';
import { AGENCY_COLOR, useCauseName } from './labels';
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
  // The same forecast as the first baseline in the game, so the two numbers always agree.
  const f = useMemo(() => runForecast(m, {}, FORECAST_SEED, 1, RUNS, { stream: 'baseline' }), [m]);
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

/** How the game is played, chosen before it starts (and not changed during it). */
export interface PlaySettings {
  tutorial: boolean; hints: boolean; practice: boolean;
  /** Seats when playing together (two or more humans); absent when playing solo. */
  seats?: SeatSetup[];
}

/** Seat setup as remembered between visits: a name left untouched stays undefined (shown in the current language). */
type SeatDraft = { control: Control; name?: string };
const DEFAULT_SEATS: SeatDraft[] = [{ control: 'human' }, { control: 'human' }, { control: 'ai' }, { control: 'ai' }];
const loadSeats = (): SeatDraft[] => {
  try {
    const v = JSON.parse(localStorage.getItem('seats') ?? 'null') as SeatDraft[] | null;
    if (Array.isArray(v) && v.length === 4) return v.map((x, i) => ({ control: i === 0 ? 'human' : x.control === 'human' ? 'human' : 'ai', ...(typeof x.name === 'string' ? { name: x.name.slice(0, 12) } : {}) }));
  } catch { /* storage unavailable */ }
  return DEFAULT_SEATS;
};
const MINUTES_PER_PLAYER = 15;

/** Final names at the start: empty ones take the default; a repeated name gets "2" on the later seat. */
function finalSeats(seats: SeatDraft[], defaultName: (n: number) => string): SeatSetup[] {
  const used = new Set<string>();
  return seats.map((s, i) => {
    if (s.control !== 'human') return { control: 'ai' };
    let name = (s.name ?? '').trim() || defaultName(i + 1);
    if (used.has(name)) name = `${name}2`;
    used.add(name);
    return { control: 'human', name };
  });
}

const loadFlag = (key: string, def: boolean) => { try { const v = localStorage.getItem(key); return v === null ? def : v === 'on'; } catch { return def; } };
const saveFlag = (key: string, on: boolean) => { try { localStorage.setItem(key, on ? 'on' : 'off'); } catch { /* storage unavailable */ } };

/** First screen: what the game is, how a turn works, and the missions to choose from. */
export function TitleScreen({ onStart, onLibrary }: { onStart: (m: Mission, s: PlaySettings) => void; onLibrary: () => void }) {
  const { t, L } = useLang();
  // Remembered between visits, like the text size and sound.
  const [guide, setGuideState] = useState(() => { try { return localStorage.getItem('showGuide') !== 'off'; } catch { return true; } });
  const setGuide = (on: boolean) => { setGuideState(on); try { localStorage.setItem('showGuide', on ? 'on' : 'off'); } catch { /* storage unavailable */ } };
  const [hints, setHintsState] = useState(() => loadFlag('allowHints', true));
  const [practice, setPracticeState] = useState(() => loadFlag('practiceMode', false));
  const setHints = (on: boolean) => { setHintsState(on); saveFlag('allowHints', on); };
  const setPractice = (on: boolean) => { setPracticeState(on); saveFlag('practiceMode', on); };
  const settingLine = practice ? t.settingPractice : !hints ? t.settingNoHints : t.settingStandard;
  // Solo or together; seats 2–4 human or AI, and the human seats' names. Remembered between visits.
  const [mode, setModeState] = useState<'solo' | 'multi'>(() => { try { return localStorage.getItem('playMode') === 'multi' ? 'multi' : 'solo'; } catch { return 'solo'; } });
  const setMode = (x: 'solo' | 'multi') => { setModeState(x); try { localStorage.setItem('playMode', x); } catch { /* storage unavailable */ } };
  const [seats, setSeatsState] = useState<SeatDraft[]>(loadSeats);
  const setSeats = (x: SeatDraft[]) => { setSeatsState(x); try { localStorage.setItem('seats', JSON.stringify(x)); } catch { /* storage unavailable */ } };
  const humans = seats.filter((x) => x.control === 'human').length;
  const multi = mode === 'multi';
  const together = multi && humans >= 2;
  const defaultName = (n: number) => fmt(t.defaultPlayerName, { n });
  const start = (m: Mission) => onStart(m, together
    ? { tutorial: false, hints, practice, seats: finalSeats(seats, defaultName) }
    : { tutorial: guide, hints, practice });
  return (
    <section className={`title ${multi ? 'multi' : ''}`}>
      <div className="title-hero">
        <TitleGlobe mission={MISSIONS[0]!} />
        <div className="hero-text">
          <p className="hero-name">{t.appTitle}</p>
          <p className="tagline">{t.tagline}</p>
          <ol className="flow" aria-label={t.flowLabel}>
            {[t.flow1, t.flow2, t.flow3, t.flow4].map((x, i) => <li key={x}><span className="flow-n">{i + 1}</span>{x}</li>)}
          </ol>
        </div>
      </div>
      <div className="mode-box">
        <div className="mode-switch" role="radiogroup">
          <button type="button" role="radio" aria-checked={!multi} className={!multi ? 'on' : ''} onClick={() => setMode('solo')}>{t.modeSolo}</button>
          <button type="button" role="radio" aria-checked={multi} className={multi ? 'on' : ''} onClick={() => setMode('multi')}>{t.modeMulti}</button>
        </div>
        {multi && (
          <div className="seats">
            {seats.map((seat, i) => {
              const id: AgencyKind = AGENCIES[i]!;
              const set = (x: Partial<SeatDraft>) => setSeats(seats.map((y, k) => (k === i ? { ...y, ...x } : y)));
              return (
                <div key={id} className="seat-row">
                  <span className="seat-dot" style={{ background: AGENCY_COLOR[id] }} aria-hidden />
                  <span className="seat-n">{fmt(t.seatN, { n: i + 1 })}</span>
                  {i === 0 ? <span className="seat-kind">{t.seatHuman}</span> : (
                    <span className="seat-toggle" role="radiogroup" aria-label={fmt(t.seatN, { n: i + 1 })}>
                      <button type="button" role="radio" aria-checked={seat.control === 'human'} className={seat.control === 'human' ? 'on' : ''} onClick={() => set({ control: 'human' })}>{t.seatHuman}</button>
                      <button type="button" role="radio" aria-checked={seat.control === 'ai'} className={seat.control === 'ai' ? 'on' : ''} onClick={() => set({ control: 'ai' })}>{t.seatAi}</button>
                    </span>
                  )}
                  {seat.control === 'human'
                    ? <input className="seat-name" type="text" maxLength={12} aria-label={fmt(t.seatN, { n: i + 1 })} value={seat.name ?? defaultName(i + 1)} onChange={(e) => set({ name: e.target.value.slice(0, 12) })} />
                    : <span className="seat-ai">{tk(t, `agency_${id}`)} <span className="ai-tag">{t.aiTag}</span></span>}
                </div>
              );
            })}
            <p className="note small seat-note">{humans >= 2 ? `${fmt(t.playTime, { n: humans * MINUTES_PER_PLAYER, k: humans })} ・ ${t.oneScreen}` : t.soloSame}</p>
          </div>
        )}
      </div>
      <div className="title-row">
        <h2>{t.chooseMission}</h2>
        <span className="title-tools">
          <span className="play-settings" role="group" aria-label={t.playSettings}>
            <span className="ps-label">{t.playSettings}</span>
            <label className={`practice ${together ? 'disabled' : ''}`} title={together ? t.guideSoloOnly : t.showGuideHelp}><input type="checkbox" checked={together ? false : guide} disabled={together} onChange={(e) => setGuide(e.target.checked)} />{t.showGuide}{together && <span className="note small"> ({t.guideSoloOnly})</span>}</label>
            <label className="practice" title={t.allowHintsHelp}><input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} />{t.allowHints}</label>
            <label className="practice" title={t.settingPractice}><input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} />{t.practiceMode}</label>
          </span>
          <button type="button" className="secondary" onClick={onLibrary}>{t.libraryOpen}</button>
        </span>
      </div>
      <p className="note small setting-line" aria-live="polite">{settingLine}</p>
      <p className="note small">{t.autoPlanNote}</p>
      <div className="missions">
        {MISSIONS.map((m) => <MissionCard key={m.id} m={m} onStart={() => start(m)} />)}
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
