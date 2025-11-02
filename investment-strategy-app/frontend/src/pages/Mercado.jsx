import React, { useEffect, useMemo, useRef, useState } from 'react';
import Notification from '../components/Notification';
import { DEFAULT_SYMBOLS } from '../services/marketData';
import { persistTradeSignals } from '../services/tradingSignals';
import { useMarketData } from '../hooks/useMarketData';
import { useMarketCharts } from '../hooks/useMarketCharts';
import '../assets/css/Mercado.css';
import '../assets/globalAssets.css';

/**
 * Pantalla Mercado.
 * Orquesta el flujo completo de datos -> graficos -> acciones:
 *  - usa `useMarketData` para obtener velas, indicadores y senales personalizadas,
 *  - delega la visualizacion en `useMarketCharts`,
 *  - gestiona el modo de ejecucion (auto o avisos) y publica cada senal en
 *    pop-ups (Notification.jsx) y en la bandeja historica del panel.
 */

const INTERVALS = [
  { label: '1h', value: '1hour' },
  { label: '2h', value: '2hour' },
  { label: '4h', value: '4hour' },
  { label: '6h', value: '6hour' },
  { label: '8h', value: '8hour' },
  { label: '12h', value: '12hour' },
];

const TRADE_MODES = {
  notify: 'notify',
  auto: 'auto',
};

const priceFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const buildToastMessage = (signal, mode) => {
  const actionLabel = signal.action === 'BUY' ? 'Compra' : 'Venta';
  const priceLabel = priceFormatter.format(signal.price ?? 0);
  const prefix = mode === TRADE_MODES.auto ? 'Auto' : 'Aviso';
  const reasons = signal.reasons.join(' | ');
  return `${prefix}: ${actionLabel} ${signal.symbol} @ ${priceLabel} (${reasons})`;
};

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
    macd: true,
    signals: true,
  });
  const [tradeMode, setTradeMode] = useState(TRADE_MODES.notify);
  const [macdThreshold, setMacdThreshold] = useState(0.15);
  const [signalLevels, setSignalLevels] = useState({ rsiOversold: 30, rsiOverbought: 70 });
  const [notifications, setNotifications] = useState([]);
  const [popup, setPopup] = useState({ open: false, message: '' });

  const intervalLabel = useMemo(
    () => INTERVALS.find((it) => it.value === interval)?.label || interval,
    [interval],
  );

  const signalConfig = useMemo(
    () => ({
      useEMA: settings.ema20 && settings.ema50,
      useRSI: settings.rsi,
      useMACD: settings.macd,
      rsiOversold: Number(signalLevels.rsiOversold) || 30,
      rsiOverbought: Number(signalLevels.rsiOverbought) || 70,
      macdHistogramThreshold: Math.max(0, Number(macdThreshold) || 0),
      minReasons: 1,
    }),
    [settings, macdThreshold, signalLevels],
  );

  const {
    candles,
    loading,
    error,
    ema20,
    ema50,
    sma200,
    rsi14,
    macdLine,
    macdSignal,
    macdHistogram,
    signals,
    tradeSignals,
  } = useMarketData({
    symbol,
    interval,
    limit: 360,
    signalConfig,
  });

  const { chartContainerRef, rsiContainerRef, macdContainerRef } = useMarketCharts({
    candles,
    ema20,
    ema50,
    sma200,
    rsi14,
    macdLine,
    macdSignal,
    macdHistogram,
    signals,
    settings,
  });

  const lastSignalRef = useRef(0);

  useEffect(() => {
    /**
     * Cada vez que `useMarketData` detecta nuevas senales, las difundimos:
     *  - registramos el evento en la bandeja local,
     *  - disparamos el toast emergente,
     *  - si el modo es auto, persistimos la senal en el backend (Signal.js).
     */
    if (!tradeSignals.length) return;

    const lastKnown = lastSignalRef.current;
    const newestTimestamp = tradeSignals[tradeSignals.length - 1].time;
    lastSignalRef.current = Math.max(lastKnown, newestTimestamp);

    const freshSignals = tradeSignals.filter((signal) => signal.time > lastKnown);
    if (!freshSignals.length) return;

    const batch = freshSignals.map((signal) => ({
      id: signal.id,
      ts: signal.time,
      recorded: Date.now(),
      action: signal.action,
      price: signal.price,
      reasons: signal.reasons,
      confidence: signal.confidence,
      symbol: signal.symbol || symbol,
      interval: signal.interval || intervalLabel,
      mode: tradeMode,
    }));

    setNotifications((prev) => {
      const next = [...batch, ...prev];
      return next.slice(0, 20);
    });

    const latest = batch[batch.length - 1];
    setPopup({
      open: true,
      message: buildToastMessage(latest, tradeMode),
    });

    if (tradeMode === TRADE_MODES.auto) {
      void persistTradeSignals(batch, {
        symbol,
        interval: intervalLabel,
        mode: tradeMode,
      })
        .then(({ errors }) => {
          if (errors.length) {
            console.warn('[signals] errores al persistir', errors);
          }
        })
        .catch((err) => {
          console.error('[signals] persistencia fallida:', err?.message);
        });
      // TODO: validar existencia previa de instrument_id en cache y mostrar feedback en la UI.
    }
  }, [tradeSignals, tradeMode, symbol, intervalLabel]);

  const handleSymbolPreset = (event) => {
    setSymbol(event.target.value);
    setCustomTicker('');
  };

  const handleSignalLevelChange = (field) => (event) => {
    const value = event.target.value;
    setSignalLevels((prev) => ({ ...prev, [field]: value }));
  };

  const volumeLabel = useMemo(() => {
    if (!candles.length) return '-';
    const latest = candles[candles.length - 1];
    return `${(latest.volume || 0).toLocaleString('en-US')} u.`;
  }, [candles]);

  const formatConfidence = (confidence) => `${Math.round((confidence || 0) * 100)}%`;

  return (
    <div className="page-mercado">
      <Notification
        message={popup.message}
        open={popup.open}
        onClose={() => setPopup({ open: false, message: '' })}
      />

      <header className="market-header">
        <div>
          <h2>Mercado</h2>
          <p>Monitorea precios, indicadores y senales automatizadas.</p>
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
                onChange={(event) => setCustomTicker(event.target.value.toUpperCase())}
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
            ['macd', 'MACD'],
            ['signals', 'Senales'],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, [key]: event.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </div>

        <div className="signal-config">
          <div className="trade-mode">
            <span>Modo:</span>
            <label>
              <input
                type="radio"
                name="trade-mode"
                value={TRADE_MODES.notify}
                checked={tradeMode === TRADE_MODES.notify}
                onChange={(event) => setTradeMode(event.target.value)}
              />
              Solo avisos
            </label>
            <label>
              <input
                type="radio"
                name="trade-mode"
                value={TRADE_MODES.auto}
                checked={tradeMode === TRADE_MODES.auto}
                onChange={(event) => setTradeMode(event.target.value)}
              />
              Auto trading
            </label>
          </div>

          <div className="config-grid">
            <label>
              <span>Umbral MACD</span>
              <input
                type="number"
                step="0.01"
                value={macdThreshold}
                onChange={(event) => setMacdThreshold(event.target.value)}
              />
            </label>
            <label>
              <span>RSI sobreventa</span>
              <input
                type="number"
                value={signalLevels.rsiOversold}
                onChange={handleSignalLevelChange('rsiOversold')}
              />
            </label>
            <label>
              <span>RSI sobrecompra</span>
              <input
                type="number"
                value={signalLevels.rsiOverbought}
                onChange={handleSignalLevelChange('rsiOverbought')}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="market-chart-wrapper">
        <div className="market-chart" ref={chartContainerRef}>
          <div className="chart-title" title="Velas, volumen e indicadores seleccionados.">
            Precio y senales
          </div>
          {loading && <div className="chart-overlay">Cargando datos...</div>}
          {!loading && error && <div className="chart-overlay error">{error}</div>}
          {!loading && !error && !candles.length && (
            <div className="chart-overlay info">Sin datos para el rango seleccionado.</div>
          )}
        </div>
        {settings.rsi && (
          <div className="market-chart rsi-chart" ref={rsiContainerRef}>
            <div className="chart-title" title="Oscilador de fuerza relativa (RSI).">
              RSI
            </div>
            {loading && <div className="chart-overlay">Calculando RSI...</div>}
            {!loading && !rsi14.length && (
              <div className="chart-overlay info">RSI requiere mas historial.</div>
            )}
          </div>
        )}
        {settings.macd && (
          <div className="market-chart macd-chart" ref={macdContainerRef}>
            <div className="chart-title" title="MACD, linea de senal e histograma.">
              MACD
            </div>
            {loading && <div className="chart-overlay">Calculando MACD...</div>}
            {!loading && !macdLine.length && (
              <div className="chart-overlay info">MACD requiere mas historial.</div>
            )}
          </div>
        )}
      </section>

      <section className="market-summary">
        <div>
          <strong>Ticker:</strong> {symbol}
        </div>
        <div>
          <strong>Intervalo:</strong> {intervalLabel}
        </div>
        <div>
          <strong>Velas cargadas:</strong> {candles.length}
        </div>
        <div>
          <strong>Volumen ultimo:</strong> {volumeLabel}
        </div>
      </section>

      <section className="notification-tray">
        <header>
          <h3>Senales recientes</h3>
          <span>{tradeMode === TRADE_MODES.auto ? 'Modo automatico' : 'Modo aviso'}</span>
        </header>
        {!notifications.length ? (
          <p className="empty-state">Aun no se detectan senales para este set de filtros.</p>
        ) : (
          <ul className="notification-list">
            {notifications.map((item) => (
              <li key={item.id} className={`notification-item ${item.action.toLowerCase()}`}>
                <div className="notification-item-head">
                  <span className="badge">{item.action}</span>
                  <span className="timestamp">
                    {new Date(item.ts * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="notification-item-body">
                  <strong>{item.symbol}</strong>
                  <span>
                    @ {priceFormatter.format(item.price ?? 0)} | {item.interval}
                  </span>
                </div>
                <div className="notification-item-reasons">{item.reasons.join(' | ')}</div>
                <div className="notification-item-meta">
                  <span>Confianza {formatConfidence(item.confidence)}</span>
                  <span>{item.mode === TRADE_MODES.auto ? 'Auto' : 'Aviso'}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Mercado;

