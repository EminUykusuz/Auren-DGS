import { useEffect, useRef } from 'react';

// Periyodik yenileme: sekme arka plandayken durur, öne gelince hemen bir kez yeniler.
// (Görünüm aynı kalır; gereksiz ağ/CPU/DB yükü biter.)
export function usePoll(fn, ms, deps = []) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    let t;
    const run = () => ref.current();
    const stop = () => { clearInterval(t); t = undefined; };
    const start = () => { stop(); t = setInterval(run, ms); };
    const onVis = () => { if (document.hidden) stop(); else { run(); start(); } };
    run(); if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [ms, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}
