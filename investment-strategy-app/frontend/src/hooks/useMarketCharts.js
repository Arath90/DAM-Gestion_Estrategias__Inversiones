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
      const { width } = chartContainerRef.current.getBoundingClientRect();
      chart.applyOptions({ width: Math.max(width, 320) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
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
      const { width } = rsiContainerRef.current.getBoundingClientRect();
      rsiChart.applyOptions({ width: Math.max(width, 320) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
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
      const { width } = macdContainerRef.current.getBoundingClientRect();
      macdChart.applyOptions({ width: Math.max(width, 320) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
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

    if (settings.volume) mapVolumeHistogram(volumeSeriesRef, candles);
    else volumeSeriesRef.current?.setData([]);

    ema20SeriesRef.current?.setData(settings.ema20 ? ema20 : []);
    ema50SeriesRef.current?.setData(settings.ema50 ? ema50 : []);
    sma200SeriesRef.current?.setData(settings.sma200 ? sma200 : []);
    candleSeriesRef.current.setMarkers(settings.signals ? signals : []);

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

