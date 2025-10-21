//src/hooks/useFetch.js

import { useEffect, useRef, useState, useCallback } from 'react';

export function useFetch(promiseFactory, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const aliveRef = useRef(true);

  const fetchData = useCallback(async () => {
    aliveRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await promiseFactory();
      if (aliveRef.current) setData(res);
    } catch (err) {
      if (aliveRef.current) setError(err);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, deps); // deps should include promiseFactory if it's not stable

  useEffect(() => {
    fetchData();
    return () => {
      aliveRef.current = false;
    };
  }, [fetchData]);

  const reload = useCallback(() => {
    aliveRef.current = true;
    fetchData();
  }, [fetchData]);

  return { data, loading, error, reload };
}
