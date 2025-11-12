import { useState, useEffect, useRef } from 'react';
import { detectSupportLevels, detectResistanceLevels } from '../utils/marketUtils';

/**
 * Hook personalizado para manejar niveles de soporte y resistencia
 */
export const useSupportResistance = (candles, chartRef) => {
  const [supportLevels, setSupportLevels] = useState([]);
  const [resistanceLevels, setResistanceLevels] = useState([]);
  const seriesRef = useRef([]);

  // Detectar niveles automáticamente
  useEffect(() => {
    if (!candles || !candles.length) {
      setSupportLevels([]);
      setResistanceLevels([]);
      return;
    }

    const supports = detectSupportLevels(candles);
    const resistances = detectResistanceLevels(candles);

    setSupportLevels(supports);
    setResistanceLevels(resistances);
  }, [candles]);

  // Dibujar líneas en el gráfico
  useEffect(() => {
    // Debounce para evitar redibujados constantes
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
        // 🔹 Soportes (líneas verdes)
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

        // 🔹 Resistencias (líneas rojas)
        resistanceLevels.forEach((level) => {
          const lineSeries = chartRef.addLineSeries({
            color: '#FF0000',
            lineWidth: 2,
            lineStyle: 2,
            title: `Resistencia ${level.toFixed(2)}`,
          });
          lineSeries.setData([
            { time: candles[0].time, value: level },
            { time: candles[candles.length - 1].time, value: level },
          ]);
          seriesRef.current.push(lineSeries);
        });

        console.log('✅ Soportes:', supportLevels);
        console.log('✅ Resistencias:', resistanceLevels);
      } catch (e) {
        console.debug('[Support/Resistance] Error dibujando niveles:', e.message);
      }
    }, 500); // Debounce de 500ms

    return () => {
      clearTimeout(timeoutId);
    };
  }, [chartRef, supportLevels, resistanceLevels, candles]);

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