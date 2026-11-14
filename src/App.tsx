import { useEffect, useState } from 'react';
import { GameScreen } from './components/GameScreen';
import { EventLibrary } from './components/EventLibrary';
import { Glossary } from './components/Glossary';
import { Modal } from './components/Modal';
import { TitleScreen, type PlaySettings } from './components/TitleScreen';
import type { Mission } from './data/types';
import { useLang } from './i18n';
import { play as playSfx, setSoundEnabled, soundEnabled } from './audio/sfx';

/** Base text size steps (px of 1rem). Every part of the game screen is sized from this. */
const SIZES = [11, 12, 13, 14, 15, 16, 18];
const loadSize = () => {
  try { const v = Number(localStorage.getItem('uiTextSize')); if (SIZES.includes(v)) return v; } catch { /* storage unavailable */ }
  return 14;
};

export function App() {
  const { lang, t, toggle } = useLang();
  const [play, setPlay] = useState<{ mission: Mission; settings: PlaySettings; key: number } | null>(null);
  const [glossary, setGlossary] = useState(false);
  const [library, setLibrary] = useState(false);
  // Playing together: leaving the game asks first (nothing is saved).
  const [askQuit, setAskQuit] = useState(false);
  const leave = () => { setPlay(null); setLibrary(false); setAskQuit(false); };
  const [size, setSize] = useState(loadSize);
  const [sound, setSound] = useState(soundEnabled);
  useEffect(() => {
    document.documentElement.style.fontSize = `${size}px`;
    try { localStorage.setItem('uiTextSize', String(size)); } catch { /* storage unavailable */ }
  }, [size]);
  const step = (d: number) => setSize(SIZES[Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(size) + d))]!);
  return (
    <div className={`app ${play || library ? 'in-game' : ''}`} lang={lang}>
      <header className="app-header">
        <h1>{t.appTitle}</h1>
        <div className="header-actions">
          {(play || library) && <button type="button" className="lang-toggle" onClick={() => (play?.settings.seats ? setAskQuit(true) : leave())}>{t.backToTitle}</button>}
          <button type="button" className="lang-toggle" data-tour="help" onClick={() => setGlossary(true)}>{t.help}</button>
          <span className="size-ctl">
            <button type="button" className="lang-toggle" aria-label={t.textSmaller} title={t.textSmaller} onClick={() => step(-1)}>A−</button>
            <button type="button" className="lang-toggle" aria-label={t.textLarger} title={t.textLarger} onClick={() => step(1)}>A＋</button>
          </span>
          <button type="button" className="lang-toggle" aria-label={sound ? t.soundOff : t.soundOn} title={sound ? t.soundOff : t.soundOn} aria-pressed={sound}
            onClick={() => { const on = !sound; setSoundEnabled(on); setSound(on); if (on) playSfx('ui'); }}>{sound ? '🔊' : '🔇'}</button>
          <button type="button" className="lang-toggle" onClick={toggle}>{t.langToggle}</button>
        </div>
      </header>
      <main className="app-main">
        {play
          ? <GameScreen key={play.key} mission={play.mission} settings={play.settings} />
          : library
            ? <EventLibrary />
            : <TitleScreen onStart={(mission, settings) => setPlay({ mission, settings, key: Date.now() })} onLibrary={() => setLibrary(true)} />}
      </main>
      {glossary && <Glossary onClose={() => setGlossary(false)} />}
      {askQuit && (
        <Modal title={t.backToTitle} onClose={() => setAskQuit(false)}>
          <p>{t.quitGame}</p>
          <div className="mission-actions">
            <button type="button" className="secondary" onClick={leave}>{t.quitYes}</button>
            <button type="button" className="primary" onClick={() => setAskQuit(false)}>{t.quitNo}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
