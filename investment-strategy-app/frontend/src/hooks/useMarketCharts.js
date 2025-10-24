import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

// Custom hook que encapsula TODO lo relacionado a charts: instanciar gráficos,
// escuchar resize, enchufar indicadores y limpiar memoria cuando cambiamos de página.
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

const resetSeries = (...seriesRefs) => {
  seriesRefs.forEach((ref) => ref.current?.setData([]));
};

export const useMarketCharts = ({ candles, ema20, ema50, rsi14, sma200, signals, settings }) => {
  // Referencias que devolvemos al componente para que React enlace el <div> con el chart real.
  const chartContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);

  const chartRef = useRef(null);
  const rsiChartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const ema20SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const sma200SeriesRef = useRef(null);
  const rsiSeriesRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    // Primer render: levantamos el gráfico principal (velas + overlays).
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

    // Cada resize de ventana recalculamos el ancho real del contenedor.
    const handleResize = () => {
      const { width } = chartContainerRef.current.getBoundingClientRect();
      chart.applyOptions({ width: Math.max(width, 320) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      // Limpiamos listeners y destruimos la instancia cuando el componente se desmonta.
      window.removeEventListener('resize', handleResize);
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

    // Solo dibujamos el chart de RSI cuando el usuario tiene la opción activa.
    const rsiChart = createChart(rsiContainerRef.current, RSI_CHART_OPTIONS);
    rsiChartRef.current = rsiChart;
    rsiSeriesRef.current = rsiChart.addLineSeries({ color: '#94a3b8', lineWidth: 2 });
    rsiSeriesRef.current.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
    rsiSeriesRef.current.createPriceLine({ price: 30, color: '#22c55e', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });

    const handleResize = () => {
      const { width } = rsiContainerRef.current.getBoundingClientRect();
      rsiChart.applyOptions({ width: Math.max(width, 320) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      // Misma limpieza que arriba pero para el chart secundario.
      window.removeEventListener('resize', handleResize);
      rsiChart.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    };
  }, [settings.rsi]);

  useEffect(() => {
    if (!settings.rsi && rsiChartRef.current) {
      rsiChartRef.current.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    }
  }, [settings.rsi]);

  useEffect(() => {
    if (!candleSeriesRef.current || !Array.isArray(candles)) return;
    if (candles.length === 0) {
      // Si no hay data, vaciamos todo para evitar renders residuales.
      resetSeries(candleSeriesRef, volumeSeriesRef, ema20SeriesRef, ema50SeriesRef, sma200SeriesRef, rsiSeriesRef);
      candleSeriesRef.current.setMarkers([]);
      return;
    }

    candleSeriesRef.current.setData(candles);

    if (settings.volume) mapVolumeHistogram(volumeSeriesRef, candles);
    else volumeSeriesRef.current?.setData([]);

    ema20SeriesRef.current?.setData(settings.ema20 ? ema20 : []);
    ema50SeriesRef.current?.setData(settings.ema50 ? ema50 : []);
    sma200SeriesRef.current?.setData(settings.sma200 ? sma200 : []);
    candleSeriesRef.current.setMarkers(settings.signals ? signals : []); // Flags visuales de buy/sell.

    if (settings.rsi) rsiSeriesRef.current?.setData(rsi14);
    else rsiSeriesRef.current?.setData([]);
  }, [candles, ema20, ema50, rsi14, settings, signals, sma200]);

  return {
    chartContainerRef,
    rsiContainerRef,
  };
};

export default useMarketCharts;
