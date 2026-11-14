import { GameScreen } from './components/GameScreen';
import { MISSIONS } from './data/missions';
import { useLang } from './i18n';

export function App() {
  const { lang, t, toggle } = useLang();
  return (
    <div className="app" lang={lang}>
      <header className="app-header">
        <h1>{t.appTitle}</h1>
        <button type="button" className="lang-toggle" onClick={toggle}>
          {t.langToggle}
        </button>
      </header>
      <main className="app-main">
        <p className="tagline">{t.tagline}</p>
        <p className="note">{t.comingSoon}</p>
        <GameScreen mission={MISSIONS[0]!} />
      </main>
    </div>
  );
}
