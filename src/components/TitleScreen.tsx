import { MISSIONS, UPCOMING } from '../data/missions';
import type { Mission } from '../data/types';
import { tk, useLang } from '../i18n';

/** First screen: what the game is, how a turn works, and the missions to choose from. */
export function TitleScreen({ onStart }: { onStart: (m: Mission, tutorial: boolean) => void }) {
  const { t, L } = useLang();
  return (
    <section className="title">
      <p className="tagline">{t.tagline}</p>
      <ol className="howto">
        <li>{t.howto1}</li>
        <li>{t.howto2}</li>
        <li>{t.howto3}</li>
      </ol>
      <h2>{t.chooseMission}</h2>
      <div className="missions">
        {MISSIONS.map((m) => (
          <div key={m.id} className="mission">
            <span className={`diff diff-${m.difficulty}`}>{tk(t, `diff_${m.difficulty}`)}</span>
            <h3>{L(m.name)}</h3>
            <p>{L(m.summary)}</p>
            <div className="mission-actions">
              <button type="button" className="primary" onClick={() => onStart(m, true)}>{t.startTutorial}</button>
              <button type="button" className="secondary" onClick={() => onStart(m, false)}>{t.startNoTutorial}</button>
            </div>
          </div>
        ))}
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
