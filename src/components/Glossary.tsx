import { tk, useLang } from '../i18n';

/** Terms explained in the glossary, in the order shown. Each has glossary_<key> (term) and glossaryDef_<key>. */
export const TERMS = [
  'margin', 'reserve', 'deltaV', 'capacity', 'sso', 'inclination', 'contact', 'downlink', 'window',
  'rideshare', 'thermalIR', 'swir', 'radHard', 'wheel', 'engineeringModel', 'forecast', 'median', 'percentile', 'changeCost',
] as const;

/** A word with a dotted underline that explains itself on hover. */
export function Term({ k, children }: { k: (typeof TERMS)[number]; children: React.ReactNode }) {
  const { t } = useLang();
  return <span className="term" title={tk(t, `glossaryDef_${k}`)}>{children}</span>;
}

/** The glossary, opened from the header. */
export function Glossary({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <div className="modal" role="dialog" aria-label={t.glossaryTitle} onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{t.glossaryTitle}</h2><button type="button" className="secondary" onClick={onClose}>{t.close}</button></div>
        <dl className="glossary">
          {TERMS.map((k) => (
            <div key={k}><dt>{tk(t, `glossary_${k}`)}</dt><dd>{tk(t, `glossaryDef_${k}`)}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}
