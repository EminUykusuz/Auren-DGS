import { useCallback, useEffect, useState } from 'react';
import { get } from './api.js';

// Basit veri yükleyici: { data, error, loading, reload }. path null ise bekler.
export function useLoad(path) {
  const [state, setState] = useState({ data: null, error: '', loading: !!path });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let on = true;
    setState(s => ({ ...s, loading: true }));
    get(path).then(data => on && setState({ data, error: '', loading: false })).catch(e => on && setState({ data: null, error: e.message, loading: false }));
    return () => { on = false; };
  }, [path, tick]);
  const reload = useCallback(() => setTick(t => t + 1), []);
  return { ...state, reload };
}
