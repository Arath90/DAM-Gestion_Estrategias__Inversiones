import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

/**
 * Bridge hook entre analytics (useMarketData) y la UI (Mercado.jsx).
 *
 * Objetivo pedagogico:
 *  - Mostrar como desacoplar la logica de charts del componente de pagina.
 *  - Detallar la interaccion con Lightweight Charts (creacion, actualizacion y limpieza).
 *
 * Que aporta:
 *  - Instancia los objetos Lightweight Charts y mantiene la data sincronizada con React.
 *  - Renderiza overlays (EMA, SMA), paneles secundarios (RSI/MACD) y marcadores de senales.
 *  - Garantiza cleanup/resize para prevenir fugas cuando se cambia de seccion.
 *
 * TODO: agregar sincronizacion de escala entre los subpanels (RSI/MACD) y el panel principal
 *  para facilitar comparaciones temporales cuando el usuario hace zoom o pan.
 */

const BASE_CHART_OPTIONS = {
  layout: {
    background: { color: '#0f172a' },
    textColor: '#e2e8f0',
    fontFamily: 'var(--project-font)',
  },
  rightPriceScale: { borderVisible: true },
  timeScale: { borderVisible: true, timeVisible: true, secondsVisible: false },
  crosshair: { mode: CrosshairMode.Normal },
  grid: {
    horzLines: { color: '#1e293b' },
    vertLines: { color: '#1e293b' },
  },
};

const RSI_CHART_OPTIONS = {
  layout: {
    background: { color: '#101b33' },
    textColor: '#e2e8f0',
    fontFamily: 'var(--project-font)',
  },
  rightPriceScale: {
    borderVisible: false,
    scaleMargins: { top: 0.1, bottom: 0.1 },
  },
  timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
  crosshair: { mode: CrosshairMode.Normal },
  grid: {
    horzLines: { color: '#1e293b' },
    vertLines: { color: '#1e293b' },
  },
};

const MACD_CHART_OPTIONS = {
  layout: {
    background: { color: '#111d34' },
    textColor: '#e2e8f0',
    fontFamily: 'var(--project-font)',
  },
  rightPriceScale: {
    borderVisible: false,
    scaleMargins: { top: 0.15, bottom: 0.15 },
  },
  timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
  crosshair: { mode: CrosshairMode.Normal },
  grid: {
    horzLines: { color: '#1e293b' },
    vertLines: { color: '#1e293b' },
  },
};

const mapVolumeHistogram = (seriesRef, candles) => {
  if (!seriesRef.current) return;
  seriesRef.current.setData(
    candles.map((candle) => ({
      time: candle.time,
      value: candle.volume ?? 0,
      color: candle.close >= candle.open ? '#47d16c88' : '#ff6b6b88',
    })),
  );
};

const mapMacdHistogram = (seriesRef, histogram) => {
  if (!seriesRef.current) return;
  seriesRef.current.setData(
    histogram.map((point) => ({
      time: point.time,
      value: point.value,
      color: point.value >= 0 ? '#22d3ee55' : '#ef444455',
    })),
  );
};

const resetSeries = (...seriesRefs) => {
  seriesRefs.forEach((ref) => ref.current?.setData([]));
};

export const useMarketCharts = ({
  candles,
  ema20,
  ema50,
  rsi14,
  sma200,
  macdLine,
  macdSignal,
  macdHistogram,
  signals,
  divergences,
  settings,
}) => {
  const chartContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const macdContainerRef = useRef(null);

  const chartRef = useRef(null);
  const rsiChartRef = useRef(null);
  const macdChartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const ema20SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const sma200SeriesRef = useRef(null);
  const rsiSeriesRef = useRef(null);
  const macdSeriesRef = useRef(null);
  const macdSignalSeriesRef = useRef(null);
  const macdHistogramSeriesRef = useRef(null);

  /*Nuevos const de Andrick y Chat */
  const divergenceLineSeriesRefs = useRef([]); // array para series de linea de divergencia en el chart principal
  const rsiDivergenceMarkersRef = useRef([]); // guardamos marcadores que colocaremos en RSI (para poder limpiarlos)

  //Nuevo codigo de Andrick y chat
    // Convierte tus signals (desde useMarketData) en markers compatibles con lightweight-charts
  const buildSignalMarkers = (signals) => {
    // signals: [{ time, action: 'BUY'|'SELL', reasons, price, timeIndex }]
    if (!Array.isArray(signals)) return [];
    return signals.map(s => ({
      time: s.time,
      position: s.action === 'BUY' ? 'belowBar' : 'aboveBar',
      color: s.action === 'BUY' ? '#16a34a' : '#ef4444',
      shape: s.action === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: s.action === 'BUY' ? 'Compra' : 'Venta'
    }));
  };

  // Renderiza lineas punteadas (divergencias) en el chart principal y marcadores en el RSI.
  const renderDivergences = (divergences = [], candles = []) => {
    // Limpia series previas
    //Codigo eliminado por Andrick
    /*if (divergenceLineSeriesRefs.current.length) {
      divergenceLineSeriesRefs.current.forEach(s => {
        try { s.remove(); } catch (e) {}
      });
      divergenceLineSeriesRefs.current = [];
    }*/

    //Codigo agregado por Andrick y chat
          // cleanup - eliminar series de divergencias si existen
      if (divergenceLineSeriesRefs.current.length) {
        divergenceLineSeriesRefs.current.forEach(s => {
          try { s.remove(); } catch(e) {}
        });
        divergenceLineSeriesRefs.current = [];
      }
      // limpiar marcadores RSI
      if (rsiSeriesRef.current) {
        try { rsiSeriesRef.current.setMarkers([]); } catch(e) {}
        rsiDivergenceMarkersRef.current = [];
      }

    // Limpia marcadores RSI previos
    if (rsiSeriesRef.current && rsiDivergenceMarkersRef.current.length) {
      try { rsiSeriesRef.current.setMarkers([]); } catch (e) {}
      rsiDivergenceMarkersRef.current = [];
    }

    if (!Array.isArray(divergences) || divergences.length === 0) return;

    // Para cada divergencia creamos:
    //  - una linea en el panel principal entre p1 (precio) y p2 (precio)
    //  - marcadores en el panel RSI (dos markers en r1Index/r2Index)
    divergences.forEach((d) => {
      // Validar indices
      const p1 = candles[d.p1Index];
      const p2 = candles[d.p2Index];

      // Dibujar linea en el chart principal si ambos puntos existen
      if (p1 && p2 && chartRef.current) {
        const lineSeries = chartRef.current.addLineSeries({
          color: '#f59e0b',
          lineWidth: 2,
          lineStyle: 2, // dashed
          priceScaleId: '' // usa escala principal
        });
        lineSeries.setData([
          { time: p1.time, value: p1.high ?? p1.close },
          { time: p2.time, value: p2.high ?? p2.close }
        ]);
        divergenceLineSeriesRefs.current.push(lineSeries);
      }

      // Agregar marcadores en RSI (si panel RSI existe)
      if (rsiSeriesRef.current) {
        const r1Index = d.r1Index;
        const r2Index = d.r2Index;
        const markers = [];

        if (typeof r1Index === 'number' && candles[r1Index]) {
          markers.push({
            time: candles[r1Index].time,
            position: 'aboveBar', // en RSI posicion relativa
            color: '#f59e0b',
            shape: 'circle',
            text: d.type === 'bullish' ? 'Bull' : 'Bear'
          });
        }
        if (typeof r2Index === 'number' && candles[r2Index]) {
          markers.push({
            time: candles[r2Index].time,
            position: 'aboveBar',
            color: '#f59e0b',
            shape: 'circle',
            text: d.type === 'bullish' ? 'Bull' : 'Bear'
          });
        }

        // Guardamos para limpiar luego
        if (markers.length) {
          // Concatenar con marcadores existentes en RSI (si hay otros)
          const existing = rsiDivergenceMarkersRef.current || [];
          const merged = existing.concat(markers);
          try {
            rsiSeriesRef.current.setMarkers(merged);
            rsiDivergenceMarkersRef.current = merged;
          } catch (e) {
            console.debug('[DIV] No se pudo setMarkers en RSI:', e.message);
          }
        }
      }
    });
  };

  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    const chart = createChart(chartContainerRef.current, BASE_CHART_OPTIONS);
    chartRef.current = chart;

    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#47d16c',
      downColor: '#ff6b6b',
      borderUpColor: '#47d16c',
      borderDownColor: '#ff6b6b',
      wickUpColor: '#47d16c',
      wickDownColor: '#ff6b6b',
    });

    volumeSeriesRef.current = chart.addHistogramSeries({
      priceScaleId: '',
      priceFormat: { type: 'volume' },
      baseValue: { type: 'price', price: 0 },
      scaleMargins: { top: 0.8, bottom: 0 },
      color: '#4f46e5aa',
    });

    ema20SeriesRef.current = chart.addLineSeries({ color: '#22d3ee', lineWidth: 2, title: 'EMA 20' });
    ema50SeriesRef.current = chart.addLineSeries({ color: '#facc15', lineWidth: 2, title: 'EMA 50' });
    sma200SeriesRef.current = chart.addLineSeries({ color: '#c084fc', lineWidth: 2, title: 'SMA 200' });

    const handleResize = () => {
      if (!chartContainerRef.current) return;
      const { width } = chartContainerRef.current.getBoundingClientRect();
      chart.applyOptions({ width: Math.max(width, 320) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Observer para detectar cambios en el tamaño del contenedor (ej: sidebar collapse)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema20SeriesRef.current = null;
      ema50SeriesRef.current = null;
      sma200SeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!settings.rsi) return;
    if (!rsiContainerRef.current || rsiChartRef.current) return;

    // Panel RSI: se crea dinamicamente segun la preferencia del usuario para ahorrar recursos.
    const rsiChart = createChart(rsiContainerRef.current, RSI_CHART_OPTIONS);
    rsiChartRef.current = rsiChart;
    rsiSeriesRef.current = rsiChart.addLineSeries({ color: '#94a3b8', lineWidth: 2 });
    rsiSeriesRef.current.createPriceLine({
      price: 70,
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
    });
    rsiSeriesRef.current.createPriceLine({
      price: 30,
      color: '#22c55e',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
    });

    const handleResize = () => {
      if (!rsiContainerRef.current) return;
      const { width } = rsiContainerRef.current.getBoundingClientRect();
      rsiChart.applyOptions({ width: Math.max(width, 320) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Observer para detectar cambios en el tamaño del contenedor
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(rsiContainerRef.current);

    // Sincronizar la escala de tiempo con el gráfico principal
    if (chartRef.current) {
      const syncRange = () => {
        if (chartRef.current && rsiChart && rsiSeriesRef.current) {
          try {
            const range = chartRef.current.timeScale().getVisibleRange();
            if (range && range.from != null && range.to != null) {
              rsiChart.timeScale().setVisibleRange(range);
            }
          } catch (e) {
            // Ignorar errores si el gráfico no está listo
            console.debug('[RSI] Error sincronizando rango:', e.message);
          }
        }
      };

      chartRef.current.timeScale().subscribeVisibleTimeRangeChange(syncRange);
      
      return () => {
        if (chartRef.current) {
          try {
            chartRef.current.timeScale().unsubscribeVisibleTimeRangeChange(syncRange);
          } catch (e) {
            // Gráfico ya destruido
          }
        }
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        rsiChart.remove();
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
      };
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      rsiChart.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    };
  }, [settings.rsi]);

  useEffect(() => {
    if (!settings.macd) return;
    if (!macdContainerRef.current || macdChartRef.current) return;

    // Panel dedicado al MACD: combina histograma (fuerza) con lineas de MACD y senal.
    const macdChart = createChart(macdContainerRef.current, MACD_CHART_OPTIONS);
    macdChartRef.current = macdChart;
    macdHistogramSeriesRef.current = macdChart.addHistogramSeries({
      priceScaleId: 'macd',
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    });
    macdSeriesRef.current = macdChart.addLineSeries({
      color: '#f97316',
      lineWidth: 2,
      priceScaleId: 'macd',
    });
    macdSignalSeriesRef.current = macdChart.addLineSeries({
      color: '#22d3ee',
      lineWidth: 2,
      priceScaleId: 'macd',
    });

    const handleResize = () => {
      if (!macdContainerRef.current) return;
      const { width } = macdContainerRef.current.getBoundingClientRect();
      macdChart.applyOptions({ width: Math.max(width, 320) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Observer para detectar cambios en el tamaño del contenedor
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(macdContainerRef.current);

    // Sincronizar la escala de tiempo con el gráfico principal
    if (chartRef.current) {
      const syncRange = () => {
        if (chartRef.current && macdChart && macdSeriesRef.current) {
          try {
            const range = chartRef.current.timeScale().getVisibleRange();
            if (range && range.from != null && range.to != null) {
              macdChart.timeScale().setVisibleRange(range);
            }
          } catch (e) {
            // Ignorar errores si el gráfico no está listo
            console.debug('[MACD] Error sincronizando rango:', e.message);
          }
        }
      };

      chartRef.current.timeScale().subscribeVisibleTimeRangeChange(syncRange);
      
      return () => {
        if (chartRef.current) {
          try {
            chartRef.current.timeScale().unsubscribeVisibleTimeRangeChange(syncRange);
          } catch (e) {
            // Gráfico ya destruido
          }
        }
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        macdChart.remove();
        macdChartRef.current = null;
        macdSeriesRef.current = null;
        macdSignalSeriesRef.current = null;
        macdHistogramSeriesRef.current = null;
      };
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      macdChart.remove();
      macdChartRef.current = null;
      macdSeriesRef.current = null;
      macdSignalSeriesRef.current = null;
      macdHistogramSeriesRef.current = null;
    };
  }, [settings.macd]);

  useEffect(() => {
    if (!settings.rsi && rsiChartRef.current) {
      rsiChartRef.current.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    }
  }, [settings.rsi]);

  useEffect(() => {
    if (!settings.macd && macdChartRef.current) {
      macdChartRef.current.remove();
      macdChartRef.current = null;
      macdSeriesRef.current = null;
      macdSignalSeriesRef.current = null;
      macdHistogramSeriesRef.current = null;
    }
  }, [settings.macd]);

  // Sincronización bidireccional entre todos los gráficos
  useEffect(() => {
    if (!chartRef.current) return;

    const charts = [
      chartRef.current,
      rsiChartRef.current,
      macdChartRef.current,
    ].filter(Boolean);

    if (charts.length <= 1) return;

    const handlers = [];

    // Crear manejadores de sincronización para cada gráfico
    charts.forEach((sourceChart, sourceIndex) => {
      const handler = () => {
        try {
          const range = sourceChart.timeScale().getVisibleRange();
          if (!range || range.from == null || range.to == null) return;

          // Sincronizar todos los demás gráficos
          charts.forEach((targetChart, targetIndex) => {
            if (sourceIndex !== targetIndex && targetChart) {
              try {
                targetChart.timeScale().setVisibleRange(range);
              } catch (e) {
                // Ignorar errores de rango inválido o datos no listos
                console.debug('[Sync] Error sincronizando:', e.message);
              }
            }
          });
        } catch (e) {
          // Ignorar errores al obtener el rango
          console.debug('[Sync] Error obteniendo rango:', e.message);
        }
      };

      sourceChart.timeScale().subscribeVisibleTimeRangeChange(handler);
      handlers.push({ chart: sourceChart, handler });
    });

    // Cleanup: desuscribir todos los manejadores
    return () => {
      handlers.forEach(({ chart, handler }) => {
        try {
          chart.timeScale().unsubscribeVisibleTimeRangeChange(handler);
        } catch (e) {
          // El gráfico puede haber sido destruido
        }
      });
    };
  }, [chartRef.current, rsiChartRef.current, macdChartRef.current]);

  useEffect(() => {
    if (!candleSeriesRef.current || !Array.isArray(candles)) return;
    if (candles.length === 0) {
      resetSeries(
        candleSeriesRef,
        volumeSeriesRef,
        ema20SeriesRef,
        ema50SeriesRef,
        sma200SeriesRef,
        rsiSeriesRef,
        macdSeriesRef,
        macdSignalSeriesRef,
        macdHistogramSeriesRef,
      );
      candleSeriesRef.current.setMarkers([]);
      return;
    }

    candleSeriesRef.current.setData(candles);

    // Ajustar la escala visible de todos los gráficos para mostrar el rango completo
    if (candles.length > 0) {
      const first = candles[0].time;
      const last = candles[candles.length - 1].time;
      
      if (first != null && last != null && first < last) {
        const range = { from: first, to: last };
        
        // Usar setTimeout para dar tiempo a que los datos se procesen
        setTimeout(() => {
          try {
            // Aplicar el rango al gráfico principal
            if (chartRef.current) {
              chartRef.current.timeScale().setVisibleRange(range);
            }
          } catch (e) {
            console.debug('[Main] Error estableciendo rango:', e.message);
          }
          
          try {
            // Aplicar el rango al RSI si está activo y tiene datos
            if (rsiChartRef.current && settings.rsi && rsiSeriesRef.current) {
              rsiChartRef.current.timeScale().setVisibleRange(range);
            }
          } catch (e) {
            console.debug('[RSI] Error estableciendo rango:', e.message);
          }
          
          try {
            // Aplicar el rango al MACD si está activo y tiene datos
            if (macdChartRef.current && settings.macd && macdSeriesRef.current) {
              macdChartRef.current.timeScale().setVisibleRange(range);
            }
          } catch (e) {
            console.debug('[MACD] Error estableciendo rango:', e.message);
          }
        }, 100);
      }
    }

    if (settings.volume) mapVolumeHistogram(volumeSeriesRef, candles);
    else volumeSeriesRef.current?.setData([]);

    ema20SeriesRef.current?.setData(settings.ema20 ? ema20 : []);
    ema50SeriesRef.current?.setData(settings.ema50 ? ema50 : []);
    sma200SeriesRef.current?.setData(settings.sma200 ? sma200 : []);
    //candleSeriesRef.current.setMarkers(settings.signals ? signals : []);
    //Codigo nuevo de Andrick y Chat
    try {
      const markers = buildSignalMarkers(signals);
      // Si el usuario no quiere ver señales, pasamos []
      candleSeriesRef.current.setMarkers(settings.signals ? markers : []);
    } catch (e) {
      console.debug('[Signals] Error seteando markers:', e.message);
      candleSeriesRef.current.setMarkers([]);
    }

    // --- Divergencias: dibujar lineas punteadas y marcadores RSI ---
    try {
      // suponemos que 'signals' y 'divergences' vienen del hook padre (useMarketData)
      // aqui 'signals' ya está disponible via props del hook; 'divergences' debes pasarlo como prop al hook useMarketCharts
      // Si no recibes divergences en las props del hook, ajusta la firma de useMarketCharts para incluirlo.
      // EJEMPLO: export const useMarketCharts = ({ candles, ..., signals, divergences, settings })
      // Ahora llamamos renderDivergences
      renderDivergences(settings.showDivergences ? (settings.divergences || []) : [], candles);
    } catch (e) {
      console.debug('[Divergencias] Error al renderizar:', e.message);
    }

    if (settings.rsi) rsiSeriesRef.current?.setData(rsi14);
    else rsiSeriesRef.current?.setData([]);

    if (settings.macd) {
      macdSeriesRef.current?.setData(macdLine);
      macdSignalSeriesRef.current?.setData(macdSignal);
      mapMacdHistogram(macdHistogramSeriesRef, macdHistogram);
    } else {
      macdSeriesRef.current?.setData([]);
      macdSignalSeriesRef.current?.setData([]);
      macdHistogramSeriesRef.current?.setData([]);
    }
  }, [
    candles,
    ema20,
    ema50,
    rsi14,
    settings,
    signals,
    sma200,
    macdLine,
    macdSignal,
    macdHistogram,
  ]);

  return {
    chartContainerRef,
    rsiContainerRef,
    macdContainerRef,
  };
};

export default useMarketCharts;

