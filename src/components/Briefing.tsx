import type { Mission } from '../data/types';
import type { Game } from '../engine/game';
import { fmt, useLang, type Messages } from '../i18n';
import { Icon } from './icons';
import { Modal } from './Modal';

/**
 * Before the first phase: what this mission is for, how the score is made, and the three things on screen
 * worth watching. One page, plain words; it can be opened again from the mission name.
 */
export function Briefing({ mission, game, onClose }: { mission: Mission; game: Game; onClose: () => void }) {
  const { t, L } = useLang();
  const r = mission.rubric;
  const parts: { key: 'primary' | 'secondary' | 'science' | 'budget' | 'schedule'; text: string }[] = [
    { key: 'primary', text: L(mission.primary.name) },
    { key: 'secondary', text: mission.secondary.map((s) => L(s.name)).join(t.listSep) },
    { key: 'science', text: fmt(t.briefScience, { unit: L(mission.rules.scienceUnit).replace(/^件の/, '') }) },
    { key: 'budget', text: t.briefBudget },
    { key: 'schedule', text: t.briefSchedule },
  ];
  return (
    <Modal title={L(mission.name)} onClose={onClose} wide>
      <div className="brief">
        <p className="brief-lead">{L(mission.summary)}</p>
        <section>
          <h3><Icon name="target" size="1.1em" /> {t.briefGoal}</h3>
          <p>{L(mission.primary.description)}</p>
          <p className="note">{t.briefWin}</p>
        </section>
        <section>
          <h3><Icon name="coins" size="1.1em" /> {t.briefScore}</h3>
          <table className="brief-score">
            <tbody>
              {parts.map((p) => (
                <tr key={p.key}>
                  <th><span className={`fb-part fb-${p.key}`} />{t[`part_${p.key}` as 'part_primary']}</th>
                  <td className="pts">{r[p.key].value}</td>
                  <td>{p.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3><Icon name="eye" size="1.1em" /> {t.briefWatch}</h3>
          <ol className="brief-watch">
            <li><b>{t.briefWatch1}</b> {t.briefWatch1Text}</li>
            <li><b>{t.briefWatch2}</b> {t.briefWatch2Text}</li>
            <li><b>{t.briefWatch3}</b> {game.hints ? t.briefWatch3Text : t.briefWatch3TextNoHint}</li>
          </ol>
        </section>
        {game.mode === 'multi' && (
          <section>
            <h3><Icon name="route" size="1.1em" /> {t.modeMulti}</h3>
            <ul className="brief-multi">
              <li>{t.briefMulti1}</li>
              <li>{t.briefMulti2}</li>
              <li>{t.briefMulti3}</li>
            </ul>
          </section>
        )}
        <p className="note brief-settings">{fmt(t.briefSettings, { s: settingsText(t, game) })}</p>
        <div className="mission-actions">
          <button type="button" className="primary" onClick={onClose}>{t.briefStart} ▶</button>
        </div>
      </div>
    </Modal>
  );
}

/** The play settings in one line, e.g. "hints on, one forecast per phase". */
export function settingsText(t: Messages, g: Pick<Game, 'hints' | 'practice'>): string {
  return [g.practice ? t.setPracticeOn : t.setForecastOnce, g.hints ? t.setHintsOn : t.setHintsOff].join(t.commaSep);
}
