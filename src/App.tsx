import { useState } from 'react';
import { GameScreen } from './components/GameScreen';
import { Glossary } from './components/Glossary';
import { TitleScreen } from './components/TitleScreen';
import type { Mission } from './data/types';
import { useLang } from './i18n';

export function App() {
  const { lang, t, toggle } = useLang();
  const [play, setPlay] = useState<{ mission: Mission; tutorial: boolean; key: number } | null>(null);
  const [glossary, setGlossary] = useState(false);
  return (
    <div className="app" lang={lang}>
      <header className="app-header">
        <h1>{t.appTitle}</h1>
        <div className="header-actions">
          {play && <button type="button" className="lang-toggle" onClick={() => setPlay(null)}>{t.backToTitle}</button>}
          <button type="button" className="lang-toggle" data-tour="help" onClick={() => setGlossary(true)}>{t.help}</button>
          <button type="button" className="lang-toggle" onClick={toggle}>{t.langToggle}</button>
        </div>
      </header>
      <main className="app-main">
        {play
          ? <GameScreen key={play.key} mission={play.mission} tutorial={play.tutorial} />
          : <TitleScreen onStart={(mission, tutorial) => setPlay({ mission, tutorial, key: Date.now() })} />}
      </main>
      {glossary && <Glossary onClose={() => setGlossary(false)} />}
    </div>
  );
}
