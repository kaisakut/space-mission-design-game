import { useEffect, type ReactNode } from 'react';
import { useLang } from '../i18n';
import { play } from '../audio/sfx';

/** A dialog over the game screen. Closes with the button, a click outside, or Escape. */
export function Modal({ title, onClose, wide = false, children }: { title: ReactNode; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const { t } = useLang();
  useEffect(() => { play('ui'); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" onClick={onClose}>
      <div className={`modal-body ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button type="button" className="secondary" onClick={onClose}>{t.close}</button></div>
        {children}
      </div>
    </div>
  );
}
