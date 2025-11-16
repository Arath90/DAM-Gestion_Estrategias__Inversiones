import { useState, useEffect, useRef } from 'react';
import { detectSupportLevels } from '../utils/marketUtils';

const API_SAP_BASE =
  (import.meta?.env?.VITE_BACKEND_URL && String(import.meta.env.VITE_BACKEND_URL).trim()) ||
  'http://localhost:4004';

const buildSapUrl = (path) => `${API_SAP_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

const detectCrestResistances = (candles, maxCount = 3) => {
  if (!Array.isArray(candles) || candles.length < 3) return [];

  const crests = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1].high;
    const curr = candles[i].high;
    const next = candles[i + 1].high;
    if (curr > prev && curr >= next) {
      crests.push({ value: curr, index: i, time: candles[i].time });
    }
  }

  const seen = new Set();
  const unique = [];
  crests
    .sort((a, b) => b.value - a.value)
    .forEach((crest) => {
      const key = crest.value.toFixed(4);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(crest);
      }
    });

  return unique.slice(0, maxCount);
};

const findSegmentsForLevels = (candles, levels) => {
  if (!Array.isArray(candles) || !Array.isArray(levels)) return [];
  if (!candles.length || !levels.length) return [];

  const crests = detectCrestResistances(candles, candles.length);

  return levels.map((level) => {
    let closest = null;
    let minDiff = Number.POSITIVE_INFINITY;

    crests.forEach((crest) => {
      const diff = Math.abs(crest.value - level);
      if (diff < minDiff) {
        minDiff = diff;
        closest = crest;
      }
    });

    if (!closest) {
      return {
        level,
        from: candles[0].time,
        to: candles[candles.length - 1].time,
      };
    }

    const fromIdx = Math.max(closest.index - 1, 0);
    const toIdx = Math.min(closest.index + 1, candles.length - 1);

    return {
      level,
      from: candles[fromIdx].time,
      to: candles[toIdx].time,
    };
  });
};

const fetchResistanceLevelsFromApi = async (candles, signal) => {
  const body = {
    candles: candles.map(({ time, open, high, low, close, volume }) => ({
      time,
      open,
      high,
      low,
      close,
      volume,
    })),
  };

  const response = await fetch(buildSapUrl('/api/indicators/resistances'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API_SAP response ${response.status}`);
  }

  const payload = await response.json();
  const rawLevels =
    payload?.data?.resistances ||
    payload?.resistances ||
    payload?.data ||
    payload;

  if (!Array.isArray(rawLevels)) {
    throw new Error('API_SAP resistances payload is not an array');
  }

  return rawLevels
    .map((entry) =>
      typeof entry === 'number' ? entry : Number(entry?.level ?? entry?.value),
    )
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)
    .slice(0, 3);
};

/**
 * Hook personalizado para manejar niveles de soporte y resistencia
 */
export const useSupportResistance = (candles, chartRef) => {
  const [supportLevels, setSupportLevels] = useState([]);
  const [resistanceLevels, setResistanceLevels] = useState([]);
  const [resistanceSegments, setResistanceSegments] = useState([]);
  const seriesRef = useRef([]);

  // Detectar niveles automaticamente
  useEffect(() => {
    if (!candles || !candles.length) {
      setSupportLevels([]);
      setResistanceLevels([]);
      setResistanceSegments([]);
      return;
    }

    setSupportLevels(detectSupportLevels(candles));

    const controller = new AbortController();

    const loadResistances = async () => {
      try {
        const resistances = await fetchResistanceLevelsFromApi(candles, controller.signal);
        setResistanceLevels(resistances);
        setResistanceSegments(findSegmentsForLevels(candles, resistances));
      } catch (err) {
        const fallbackCrests = detectCrestResistances(candles);
        const fallbackLevels = fallbackCrests.map((crest) => crest.value);
        setResistanceLevels(fallbackLevels);
        setResistanceSegments(findSegmentsForLevels(candles, fallbackLevels));
        console.debug('[Support/Resistance] Fallback resistances used:', err?.message);
      }
    };

    loadResistances();

    return () => controller.abort();
  }, [candles]);

  // Dibujar lineas en el grafico
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!chartRef || (!supportLevels.length && !resistanceLevels.length) || !candles.length) {
        return;
      }

      console.log(`[Support/Resistance] Dibujando ${supportLevels.length} soportes y ${resistanceLevels.length} resistencias`);

      // Limpiar series anteriores
      seriesRef.current.forEach((series) => {
        try {
          chartRef.removeSeries(series);
        } catch (e) {
          console.debug('[Support/Resistance] Error removiendo serie anterior:', e.message);
        }
      });
      seriesRef.current = [];

      try {
        // Soportes (lineas verdes)
        supportLevels.forEach((level) => {
          const lineSeries = chartRef.addLineSeries({
            color: '#00FF00',
            lineWidth: 2,
            lineStyle: 2,
            title: `Soporte ${level.toFixed(2)}`,
          });
          lineSeries.setData([
            { time: candles[0].time, value: level },
            { time: candles[candles.length - 1].time, value: level },
          ]);
          seriesRef.current.push(lineSeries);
        });

        // Resistencias (lineas rojas) graficadas sobre crestas
        const segmentsToDraw = resistanceSegments.length
          ? resistanceSegments
          : findSegmentsForLevels(candles, resistanceLevels);

        segmentsToDraw.forEach(({ level, from, to }) => {
          const lineSeries = chartRef.addLineSeries({
            color: '#FF0000',
            lineWidth: 2,
            lineStyle: 2,
            title: `Resistencia ${level.toFixed(2)}`,
          });
          lineSeries.setData([
            { time: from, value: level },
            { time: to, value: level },
          ]);
          seriesRef.current.push(lineSeries);
        });

        console.log('[Support/Resistance] Soportes:', supportLevels);
        console.log('[Support/Resistance] Resistencias:', resistanceLevels);
      } catch (e) {
        console.debug('[Support/Resistance] Error dibujando niveles:', e.message);
      }
    }, 500); // Debounce de 500ms

    return () => {
      clearTimeout(timeoutId);
    };
  }, [chartRef, supportLevels, resistanceLevels, resistanceSegments, candles]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      seriesRef.current.forEach((series) => {
        try {
          if (chartRef) {
            chartRef.removeSeries(series);
          }
        } catch (e) {
          console.debug('[Support/Resistance] Error en cleanup:', e.message);
        }
      });
      seriesRef.current = [];
    };
  }, [chartRef]);

  return {
    supportLevels,
    resistanceLevels,
    setSupportLevels,
    setResistanceLevels,
  };
};
