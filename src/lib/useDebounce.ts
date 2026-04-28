import { useEffect, useState } from 'react';

/**
 * Returns a value that updates only after `delay` ms have passed
 * since the last input change. Used for username availability check.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}
