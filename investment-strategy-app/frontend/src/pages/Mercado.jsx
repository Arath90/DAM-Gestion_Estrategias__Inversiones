import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { DEFAULT_SYMBOLS } from '../services/marketData';
import { useMarketData } from '../hooks/useMarketData';
import '../assets/css/Mercado.css';
import '../assets/globalAssets.css';

const INTERVALS = [
  { label: '1h', value: '1hour' },
  { label: '2h', value: '2hour' },
  { label: '4h', value: '4hour' },
  { label: '6h', value: '6hour' },
  { label: '8h', value: '8hour' },
  { label: '12h', value: '12hour' },
];

const Mercado = () => {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOLS[0]?.value || 'I:NDX');
  const [interval, setInterval] = useState(INTERVALS[0].value);
  const [customTicker, setCustomTicker] = useState('');
  const [settings, setSettings] = useState({
    ema20: true,
    ema50: true,
    sma200: false,
    volume: true,
    rsi: true,
    signals: true,
  });

  const { candles, loading, error, ema20, ema50, sma200, rsi14, signals } = useMarketData({
    symbol,
    interval,
    limit: 360,
  });

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

    const chart = createChart(chartContainerRef.current, {
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
    });
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

    const resize = () => {
      const { width } = chartContainerRef.current.getBoundingClientRect();
      chart.applyOptions({ width: Math.max(width, 320) });
    };
    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
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
    if (!rsiContainerRef.current || rsiChartRef.current) return;

    const rsiChart = createChart(rsiContainerRef.current, {
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
    });
    rsiChartRef.current = rsiChart;
    rsiSeriesRef.current = rsiChart.addLineSeries({ color: '#94a3b8', lineWidth: 2 });
    rsiSeriesRef.current.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
    rsiSeriesRef.current.createPriceLine({ price: 30, color: '#22c55e', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });

    const resize = () => {
      const { width } = rsiContainerRef.current.getBoundingClientRect();
      rsiChart.applyOptions({ width: Math.max(width, 320) });
    };
    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      rsiChart.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !Array.isArray(candles)) return;
    if (candles.length === 0) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current?.setData([]);
      ema20SeriesRef.current?.setData([]);
      ema50SeriesRef.current?.setData([]);
      sma200SeriesRef.current?.setData([]);
      candleSeriesRef.current.setMarkers([]);
      rsiSeriesRef.current?.setData([]);
      return;
    }

    candleSeriesRef.current.setData(candles);
    if (settings.volume && volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(
        candles.map((candle) => ({
          time: candle.time,
          value: candle.volume ?? 0,
          color: candle.close >= candle.open ? '#47d16c88' : '#ff6b6b88',
        })),
      );
    } else {
      volumeSeriesRef.current?.setData([]);
    }

    if (ema20SeriesRef.current) ema20SeriesRef.current.setData(settings.ema20 ? ema20 : []);
    if (ema50SeriesRef.current) ema50SeriesRef.current.setData(settings.ema50 ? ema50 : []);
    if (sma200SeriesRef.current) sma200SeriesRef.current.setData(settings.sma200 ? sma200 : []);
    candleSeriesRef.current.setMarkers(settings.signals ? signals : []);

    if (rsiSeriesRef.current) {
      if (settings.rsi) rsiSeriesRef.current.setData(rsi14);
      else rsiSeriesRef.current.setData([]);
    }
  }, [candles, ema20, ema50, sma200, rsi14, signals, settings]);

  const handleSymbolPreset = (event) => {
    setSymbol(event.target.value);
    setCustomTicker('');
  };

  const volumeLabel = useMemo(() => {
    if (!candles.length) return '-';
    const latest = candles[candles.length - 1];
    return `${(latest.volume || 0).toLocaleString('en-US')} u.`;
  }, [candles]);

  return (
    <div className="page-mercado">
      <header className="market-header">
        <div>
          <h2>Mercado</h2>
          <p>Consulta datos de velas de la API publica, agrega indicadores y genera senales basicas.</p>
        </div>
        <div className="market-header-actions">
          <label className="control-block">
            <span>Instrumento</span>
            <select value={symbol} onChange={handleSymbolPreset}>
              {DEFAULT_SYMBOLS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="control-block">
            <span>Ticker personalizado</span>
            <div className="custom-input">
              <input
                value={customTicker}
                onChange={(e) => setCustomTicker(e.target.value.toUpperCase())}
                placeholder="Ej. TSLA"
              />
              <button
                type="button"
                onClick={() => {
                  if (customTicker.trim()) {
                    setSymbol(customTicker.trim().toUpperCase());
                  }
                }}
              >
                Cargar
              </button>
            </div>
          </label>
        </div>
      </header>

      <section className="market-controls">
        <div className="intervals">
          <span>Intervalos:</span>
          {INTERVALS.map((itv) => (
            <button
              key={itv.value}
              type="button"
              className={interval === itv.value ? 'active' : ''}
              onClick={() => setInterval(itv.value)}
            >
              {itv.label}
            </button>
          ))}
        </div>
        <div className="switches">
          {[
            ['ema20', 'EMA20'],
            ['ema50', 'EMA50'],
            ['sma200', 'SMA200'],
            ['volume', 'Volumen'],
            ['rsi', 'RSI'],
            ['signals', 'Senales'],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="market-chart-wrapper">
        <div className="market-chart" ref={chartContainerRef}>
          {loading && <div className="chart-overlay">Cargando datos...</div>}
          {!loading && error && <div className="chart-overlay error">{error}</div>}
        </div>
        {settings.rsi && (
          <div className="market-chart rsi-chart" ref={rsiContainerRef}>
            {loading && <div className="chart-overlay">Calculando RSI...</div>}
          </div>
        )}
      </section>

      <section className="market-summary">
        <div>
          <strong>Ticker:</strong> {symbol}
        </div>
        <div>
          <strong>Intervalo:</strong> {INTERVALS.find((i) => i.value === interval)?.label || interval}
        </div>
        <div>
          <strong>Velas cargadas:</strong> {candles.length}
        </div>
        <div>
          <strong>Volumen ultimo:</strong> {volumeLabel}
        </div>
      </section>
    </div>
  );
};

export default Mercado;
