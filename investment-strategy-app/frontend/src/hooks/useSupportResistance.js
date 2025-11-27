import { useState, useEffect, useRef } from 'react';
import { detectSupportLevels } from '../utils/marketUtils';
import {
  fetchResistanceLevelsFromApi,
  detectCrestResistances,
  findSegmentsForLevels,
  removeChartSeries,
  drawSupportLevels,
  drawResistanceLevels,
} from '../utils/supportResistanceUtils';

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
      removeChartSeries(chartRef, seriesRef.current);
      seriesRef.current = [];

      try {
        // Dibujar soportes (lineas verdes)
        const supportSeries = drawSupportLevels(chartRef, supportLevels, candles);
        seriesRef.current.push(...supportSeries);

        // Dibujar resistencias (lineas rojas) graficadas sobre crestas
        const segmentsToDraw = resistanceSegments.length
          ? resistanceSegments
          : findSegmentsForLevels(candles, resistanceLevels);

        const resistanceSeries = drawResistanceLevels(chartRef, segmentsToDraw);
        seriesRef.current.push(...resistanceSeries);

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
      removeChartSeries(chartRef, seriesRef.current);
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
