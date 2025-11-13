import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

// Helper para logging seguro
const safeLog = (level, message, error = null) => {
  const errorMsg = error?.message || error?.toString() || 'Error desconocido';
  console[level](message, error ? errorMsg : '');
};

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
 *  
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
  if (!seriesRef.current || !Array.isArray(candles)) return;
  try {
    const volumeData = candles
      .filter(candle => candle && typeof candle.time === 'number' && typeof candle.volume === 'number')
      .map((candle) => ({
        time: candle.time,
        value: candle.volume ?? 0,
        color: candle.close >= candle.open ? '#47d16c88' : '#ff6b6b88',
      }));
    seriesRef.current.setData(volumeData);
  } catch (e) {
    console.debug('[Volume] Error estableciendo histograma de volumen:', e.message);
  }
};

const mapMacdHistogram = (seriesRef, histogram) => {
  if (!seriesRef.current || !Array.isArray(histogram)) return;
  try {
    const histogramData = histogram
      .filter(point => point && typeof point.time === 'number' && typeof point.value === 'number')
      .map((point) => ({
        time: point.time,
        value: point.value,
        color: point.value >= 0 ? '#22d3ee55' : '#ef444455',
      }));
    seriesRef.current.setData(histogramData);
  } catch (e) {
    console.debug('[MACD] Error estableciendo histograma MACD:', e.message);
  }
};

const resetSeries = (...seriesRefs) => {
  seriesRefs.forEach((ref) => {
    try {
      if (ref.current && typeof ref.current.setData === 'function') {
        ref.current.setData([]);
      }
    } catch (e) {
      console.debug('[Reset] Error reseteando serie:', e.message);
    }
  });
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

  const divergenceLineSeriesRefs = useRef([]);
  const rsiDivergenceMarkersRef = useRef([]);
  //Codigo agregado por Andrick y chat
  const syncingRef = useRef(false);

  //Nuevo codigo de Andrick y chat
    // Convierte tus signals (desde useMarketData) en markers compatibles con lightweight-charts
  const buildSignalMarkers = (signals) => {
    // signals: [{ time, action: 'BUY'|'SELL', reasons, price, timeIndex }]
    if (!Array.isArray(signals)) return [];
    try {
      return signals
        .filter(s => s && typeof s.time === 'number' && (s.action === 'BUY' || s.action === 'SELL'))
        .map(s => ({
          time: s.time,
          position: s.action === 'BUY' ? 'belowBar' : 'aboveBar',
          color: s.action === 'BUY' ? '#16a34a' : '#ef4444',
          shape: s.action === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: s.action === 'BUY' ? 'Compra' : 'Venta'
        }));
    } catch (e) {
      safeLog('debug', '[Signals] Error construyendo marcadores:', e);
      return [];
    }
  };

  // Renderiza lineas punteadas (divergencias) en el chart principal y marcadores en el RSI.
  const renderDivergences = (divergences = [], candles = []) => {
    try {
      // limpiar series de lineas dibujadas en precio
      if (divergenceLineSeriesRefs.current && divergenceLineSeriesRefs.current.length) {
        divergenceLineSeriesRefs.current.forEach(s => { try { s.remove(); } catch (e) {} });
        divergenceLineSeriesRefs.current = [];
      }
      // limpiar marcadores en RSI
      if (rsiSeriesRef.current) {
        try { rsiSeriesRef.current.setMarkers([]); } catch (e) {}
        rsiDivergenceMarkersRef.current = [];
      }
    } catch (e) {
      console.debug('[DIV] cleanup error:', e?.message || e);
    }

    if (!Array.isArray(divergences) || divergences.length === 0) return;
    if (!Array.isArray(candles) || candles.length === 0) return;

    // Simplemente colocar markers en RSI y, si aplica, la línea punteada en precio (mantener mínimo)
    divergences.forEach((d) => {
      try {
        const p1 = candles[d.p1Index];
        const p2 = candles[d.p2Index];
        if (!p1 || !p2) return;

        // marcar picos en el RSI (si existen índices)
        const r1Index = d.r1Index;
        const r2Index = d.r2Index;

        if (rsiSeriesRef.current && (r1Index != null || r2Index != null)) {
          const markers = [];
          if (r1Index != null && candles[r1Index]) markers.push({ time: candles[r1Index].time, position: 'aboveBar', color: '#f59e0b', shape: 'circle', text: d.type === 'bullish' ? 'Bull' : 'Bear' });
          if (r2Index != null && candles[r2Index]) markers.push({ time: candles[r2Index].time, position: 'aboveBar', color: '#f59e0b', shape: 'circle', text: d.type === 'bullish' ? 'Bull' : 'Bear' });
          if (markers.length) {
            const existing = rsiDivergenceMarkersRef.current || [];
            const merged = existing.concat(markers);
            try { rsiSeriesRef.current.setMarkers(merged); rsiDivergenceMarkersRef.current = merged; } catch (e) { console.debug('[DIV] setMarkers failed:', e?.message || e); }
          }
        }

        // Si se desea, el profesor pedía opcionalmente una línea discontinua entre p1 y p2 en el precio.
        // Mantendremos esto opcional y simple: solo dibujaremos la línea de precio si d.showPriceLine === true
        if (d.showPriceLine && chartRef.current) {
          try {
            const color = d.type === 'bullish' ? 'rgba(16,185,129,0.9)' : 'rgba(220,38,38,0.9)';
            const ls = chartRef.current.addLineSeries({ color, lineWidth: 2, lineStyle: 2, priceLineVisible: false });
            ls.setData([
              { time: p1.time, value: p1.high ?? p1.close },
              { time: p2.time, value: p2.high ?? p2.close }
            ]);
            divergenceLineSeriesRefs.current.push(ls);
          } catch (e) {
            console.debug('[DIV] Error dibujando linea de precio (opcional):', e?.message || e);
          }
        }

      } catch (e) {
        console.debug('[DIV] error processing divergence', e?.message || e);
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
    // Sincronización centralizada entre gráficos (evita loops y aplica rango solo si cambia)
  useEffect(() => {
    if (!chartRef.current) return;

    const charts = [
      chartRef.current,
      rsiChartRef.current,
      macdChartRef.current,
    ].filter(Boolean);

    if (charts.length <= 1) return;

    const handlers = [];

    // Handler que propaga el rango desde sourceChart al resto evitando recursión
    const createHandler = (sourceChart) => {
      return () => {
        try {
          // Si ya estamos sincronizando por otra fuente, salir rápido
          if (syncingRef.current) return;

          const range = sourceChart.timeScale().getVisibleRange();
          if (!range || range.from == null || range.to == null) return;

          // Marcar que estamos sincronizando para bloquear reentradas
          syncingRef.current = true;

          charts.forEach((targetChart) => {
            if (targetChart === sourceChart) return;
            try {
              const targetRange = targetChart.timeScale().getVisibleRange();
              // Aplicar solo si realmente difiere (evita sets redundantes)
              const sameFrom = targetRange && targetRange.from === range.from;
              const sameTo = targetRange && targetRange.to === range.to;
              if (!sameFrom || !sameTo) {
                targetChart.timeScale().setVisibleRange(range);
              }
            } catch (e) {
              // ignorar errores individuales por charts no listos
            }
          });
        } catch (e) {
          console.debug('[Sync] Error propagando rango:', e?.message || e);
        } finally {
          // Liberar el bloqueo con un pequeño retardo para permitir que los charts procesen
          setTimeout(() => { syncingRef.current = false; }, 50);
        }
      };
    };

    charts.forEach((sourceChart) => {
      const handler = createHandler(sourceChart);
      try {
        sourceChart.timeScale().subscribeVisibleTimeRangeChange(handler);
        handlers.push({ chart: sourceChart, handler });
      } catch (e) {
        console.debug('[Sync] No fue posible subscribir a timeScale:', e?.message || e);
      }
    });

    // Cleanup
    return () => {
      handlers.forEach(({ chart, handler }) => {
        try { chart.timeScale().unsubscribeVisibleTimeRangeChange(handler); } catch (e) {}
      });
    };
  }, [chartRef.current, rsiChartRef.current, macdChartRef.current]);

  useEffect(() => {
    if (!candleSeriesRef.current || !Array.isArray(candles)) return;
    
    // Verificación adicional para asegurar que el gráfico esté completamente inicializado
    if (!chartRef.current) {
      console.debug('[Charts] Gráfico principal no inicializado, esperando...');
      return;
    }

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
      try {
        candleSeriesRef.current.setMarkers([]);
      } catch (e) {
        console.debug('[Charts] Error limpiando marcadores:', e.message);
      }
      return;
    }

    try {
      // Verificar que los datos de velas sean válidos
      const validCandles = candles.filter(candle => 
        candle && 
        typeof candle.time === 'number' && 
        typeof candle.open === 'number' && 
        typeof candle.high === 'number' && 
        typeof candle.low === 'number' && 
        typeof candle.close === 'number'
      );

      if (validCandles.length === 0) {
        console.debug('[Charts] No hay velas válidas para mostrar');
        return;
      }

      candleSeriesRef.current.setData(validCandles);
      console.debug(`[Charts] Datos establecidos: ${validCandles.length} velas`);

      // Ajustar la escala visible de todos los gráficos para mostrar el rango completo
      if (validCandles.length > 0) {
        const first = validCandles[0].time;
        const last = validCandles[validCandles.length - 1].time;
        
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

      // Volumen
      try {
        if (settings.volume && volumeSeriesRef.current) {
          mapVolumeHistogram(volumeSeriesRef, validCandles);
        } else if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData([]);
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo volumen:', e.message);
      }

      // Indicadores de línea
      try {
        if (ema20SeriesRef.current) {
          ema20SeriesRef.current.setData(settings.ema20 ? ema20 : []);
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo EMA20:', e.message);
      }

      try {
        if (ema50SeriesRef.current) {
          ema50SeriesRef.current.setData(settings.ema50 ? ema50 : []);
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo EMA50:', e.message);
      }

      try {
        if (sma200SeriesRef.current) {
          sma200SeriesRef.current.setData(settings.sma200 ? sma200 : []);
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo SMA200:', e.message);
      }

      // Señales
      try {
        const markers = buildSignalMarkers(signals);
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setMarkers(settings.signals ? markers : []);
        }
      } catch (e) {
        console.debug('[Signals] Error seteando markers:', e.message);
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setMarkers([]);
        }
      }

      // Divergencias
      try {
        renderDivergences(settings.showDivergences ? (divergences || []) : [], validCandles);
      } catch (e) {
        console.debug('[Divergencias] Error al renderizar:', e.message);
      }

      // RSI
      try {
        if (settings.rsi && rsiSeriesRef.current) {
          rsiSeriesRef.current.setData(rsi14);
        } else if (rsiSeriesRef.current) {
          rsiSeriesRef.current.setData([]);
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo RSI:', e.message);
      }

      // MACD
      try {
        if (settings.macd) {
          if (macdSeriesRef.current) {
            macdSeriesRef.current.setData(macdLine);
          }
          if (macdSignalSeriesRef.current) {
            macdSignalSeriesRef.current.setData(macdSignal);
          }
          if (macdHistogramSeriesRef.current) {
            mapMacdHistogram(macdHistogramSeriesRef, macdHistogram);
          }
        } else {
          if (macdSeriesRef.current) {
            macdSeriesRef.current.setData([]);
          }
          if (macdSignalSeriesRef.current) {
            macdSignalSeriesRef.current.setData([]);
          }
          if (macdHistogramSeriesRef.current) {
            macdHistogramSeriesRef.current.setData([]);
          }
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo MACD:', e?.message || 'Error desconocido');
      }

    } catch (e) {
      safeLog('error', '[Charts] Error general estableciendo datos del gráfico:', e);
    }
  }, [
    candles,
    ema20,
    ema50,
    rsi14,
    settings,
    signals,
    divergences,
    sma200,
    macdLine,
    macdSignal,
    macdHistogram,
  ]);


  return {
    chartContainerRef,
    rsiContainerRef,
    macdContainerRef,
    // Exponer las referencias de los charts para funcionalidades adicionales
    chartRef: chartRef.current,
    rsiChartRef: rsiChartRef.current,
    macdChartRef: macdChartRef.current,
    candleSeriesRef: candleSeriesRef.current,
  };
};
export default useMarketCharts;