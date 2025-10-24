import React, { useMemo, useState } from 'react';
import { DEFAULT_SYMBOLS } from '../services/marketData';
import { useMarketData } from '../hooks/useMarketData';
import { useMarketCharts } from '../hooks/useMarketCharts';
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
  // Estado básico para elegir qué activo y qué indicadores queremos ver.
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

  // Hook que pega al backend, trae velas e indicadores calculados.
  const { candles, loading, error, ema20, ema50, sma200, rsi14, signals } = useMarketData({
    symbol,
    interval,
    limit: 360,
  });

  // Hook que arma y mantiene los objetos LightweightCharts.
  const { chartContainerRef, rsiContainerRef } = useMarketCharts({
    candles,
    ema20,
    ema50,
    sma200,
    rsi14,
    signals,
    settings,
  });

  // Menú rápido de símbolos predefinidos.
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
          <p>Candles</p>
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
