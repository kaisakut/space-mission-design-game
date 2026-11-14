import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * A box of fixed size whose text shrinks until the content fits (down to `min` times the normal size).
 * Children must size their text in em so they scale with it. If even the smallest size overflows, the box scrolls.
 */
export function AutoFit({ children, className = '', min = 0.62, ...rest }: { children: ReactNode; className?: string; min?: number } & Record<`data-${string}`, string>) {
  const ref = useRef<HTMLDivElement>(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el || el.clientHeight === 0) return;
    const fits = () => el.scrollHeight <= el.clientHeight + 2;
    el.style.fontSize = '1em';
    if (fits()) return;
    let lo = min, hi = 1;
    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}em`;
      if (fits()) lo = mid; else hi = mid;
    }
    el.style.fontSize = `${lo}em`;
  }, [min]);
  // Refit after every render (content may have changed) and whenever the box is resized.
  useLayoutEffect(fit);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [fit]);
  return <div ref={ref} className={`autofit ${className}`} {...rest}>{children}</div>;
}
