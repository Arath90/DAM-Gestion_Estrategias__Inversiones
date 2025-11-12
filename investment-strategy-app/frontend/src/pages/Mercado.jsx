import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Notification from '../components/Notification';
import { DEFAULT_SYMBOLS } from '../services/marketData';
import { persistTradeSignals } from '../services/tradingSignals';
import { useMarketData } from '../hooks/useMarketData';
import { useMarketCharts } from '../hooks/useMarketCharts';
import api from '../config/apiClient';
import {
  DEFAULT_INDICATOR_SETTINGS,
  DEFAULT_SIGNAL_CONFIG,
  INDICATOR_TOGGLES,
  hydrateStrategyProfile,
} from '../constants/strategyProfiles';
import '../assets/css/Mercado.css';
import '../assets/globalAssets.css';
//todo: eliminar indicadores tecnicos para que solo se seleccione una estrategia de trading en un combobox, entonces tanto indicadores como configuracion de señales se adaptan a la estrategia seleccionada, esto quiere decir que en estrategias.jsx  se debe agregar la logica para definir que indicadores y configuraciones de señales se usan por estrategia. asi como el asignarlo a una estrategia en la creacion/edicion de estrategias que esto a su vez se va a mostrar en un combo box en esta pantalla de mercado lo cual debe hacer funcion de filtro para los datos que se muestran en el grafico y las señales generadas.
/**
 * Pantalla Mercado.
 * Orquesta el flujo completo de datos -> graficos -> acciones:
 *  - usa `useMarketData` para obtener velas, indicadores y senales personalizadas,
 *  - delega la visualizacion en `useMarketCharts`,
 *  - gestiona el modo de ejecucion (auto o avisos) y publica cada senal en
 *    pop-ups (Notification.jsx) y en la bandeja historica del panel.
 */

const INTERVALS = [
  { label: '1D', fullLabel: '1 Día', value: '1day', group: 'largo' },
  { label: '12H', fullLabel: '12 Horas', value: '12hour', group: 'largo' },
  { label: '8H', fullLabel: '8 Horas', value: '8hour', group: 'medio' },
  { label: '6H', fullLabel: '6 Horas', value: '6hour', group: 'medio' },
  { label: '4H', fullLabel: '4 Horas', value: '4hour', group: 'medio' },
  { label: '2H', fullLabel: '2 Horas', value: '2hour', group: 'corto' },
  { label: '1H', fullLabel: '1 Hora', value: '1hour', group: 'corto' },
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

const STRATEGY_BASE_PARAMS = { dbServer: 'MongoDB', ProcessType: 'READ', $top: 50 };

const collectStrategyNodes = (node) => {
  if (!node || typeof node !== 'object') return [];
  const bucket = [];
  if (Array.isArray(node.dataRes)) bucket.push(...node.dataRes);
  else if (node.dataRes && typeof node.dataRes === 'object') bucket.push(node.dataRes);
  if (Array.isArray(node.data)) node.data.forEach((entry) => bucket.push(...collectStrategyNodes(entry)));
  return bucket;
};

const normalizeStrategiesResponse = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload.value)) {
    const collected = payload.value.flatMap(collectStrategyNodes);
    return collected.length ? collected : payload.value;
  }
  const collected = collectStrategyNodes(payload);
  if (collected.length) return collected;
  if (Array.isArray(payload)) return payload;
  if (payload.data) return normalizeStrategiesResponse(payload.data);
  return [payload];
};

const attachStrategyKey = (list = []) =>
  list.map((item, idx) => ({
    ...item,
    __frontendId:
      item.ID || item._id || item.strategy_code || item.name || `strategy-${idx}`,
  }));

const getStrategyKey = (strategy) => strategy?.__frontendId || '';

const fetchStrategiesCatalog = async () => {
  const { data } = await api.get('/Strategies', { params: STRATEGY_BASE_PARAMS });
  return attachStrategyKey(normalizeStrategiesResponse(data));
};

const Mercado = () => {
  // 1. Estados y datos
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOLS[0]?.value || 'I:NDX');
  const [interval, setInterval] = useState(INTERVALS[0].value);
  const [customTicker, setCustomTicker] = useState('');
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_INDICATOR_SETTINGS }));
  const [tradeMode, setTradeMode] = useState(TRADE_MODES.notify);
  const [strategySignalConfig, setStrategySignalConfig] = useState(() => ({ ...DEFAULT_SIGNAL_CONFIG }));
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState('');
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [popup, setPopup] = useState({ open: false, message: '' });

  const loadStrategies = useCallback(async () => {
    setStrategiesLoading(true);
    setStrategiesError('');
    try {
      const catalog = await fetchStrategiesCatalog();
      setStrategies(Array.isArray(catalog) ? catalog.filter((item) => getStrategyKey(item)) : []);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No se pudieron cargar las estrategias.';
      setStrategiesError(message);
    } finally {
      setStrategiesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  useEffect(() => {
    if (!strategies.length) {
      setSelectedStrategyId('');
      return;
    }
    const exists = strategies.some((strategy) => getStrategyKey(strategy) === selectedStrategyId);
    if (!exists) {
      setSelectedStrategyId(getStrategyKey(strategies[0]));
    }
  }, [strategies, selectedStrategyId]);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => getStrategyKey(strategy) === selectedStrategyId) || null,
    [strategies, selectedStrategyId],
  );

  useEffect(() => {
    const { indicatorSettings, signalConfig: cfg } = hydrateStrategyProfile(selectedStrategy);
    setSettings(indicatorSettings);
    setStrategySignalConfig(cfg);
  }, [selectedStrategy]);

  const intervalLabel = useMemo(
    () => INTERVALS.find((it) => it.value === interval)?.fullLabel || interval,
    [interval],
  );

  const indicatorBadges = useMemo(
    () => INDICATOR_TOGGLES.filter(({ key }) => settings[key]),
    [settings],
  );

  const signalConfig = useMemo(
    () => ({
      ...DEFAULT_SIGNAL_CONFIG,
      ...strategySignalConfig,
      useEMA: settings.ema20 && settings.ema50,
      useRSI: settings.rsi,
      useMACD: settings.macd,
    }),
    [strategySignalConfig, settings],
  );

  // Calcular el límite de velas necesario para cubrir 1 año según el intervalo
  // NOTA: Usamos límites más conservadores para evitar rate limiting
  const getLimitForInterval = (interval) => {
    switch (interval) {
      case '1day': return 365; // 365 días = 1 año
      case '12hour': return 730; // 730 períodos de 12h = 1 año
      case '8hour': return 1095; // 1095 períodos de 8h = 1 año
      case '6hour': return 1460; // 1460 períodos de 6h = 1 año
      case '4hour': return 2190; // 2190 períodos de 4h = 1 año
      case '2hour': return 2000; // Limitado a 2000 para evitar rate limit
      case '1hour': return 2000; // Limitado a 2000 para evitar rate limit (~83 días)
      default: return 365;
    }
  };

  const limit = useMemo(() => {
    const calculatedLimit = getLimitForInterval(interval);
    console.log(`[Mercado] Intervalo: ${interval}, Límite de velas: ${calculatedLimit}`);
    return calculatedLimit;
  }, [interval]);

  const [range, setRange] = useState(() => {
    const now = Math.floor(Date.now() / 1000);
    const oneYearAgo = now - 365 * 24 * 60 * 60;
    return { from: oneYearAgo, to: now };
  });

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
    divergences,
  } = useMarketData({
    symbol,
    interval,
    limit, // Ahora el límite es dinámico según el intervalo para cubrir 1 año
    signalConfig,
  });

  // Función para cargar más velas hacia atrás
  const loadMoreCandles = () => {
    setRange((prev) => ({
      from: prev.from - limit * getSecondsPerCandle(interval),
      to: prev.to,
    }));
  };

  function getSecondsPerCandle(interval) {
    switch (interval) {
      case '1hour': return 3600;
      case '2hour': return 7200;
      case '4hour': return 14400;
      case '6hour': return 21600;
      case '8hour': return 28800;
      case '12hour': return 43200;
      case '1day': return 86400;
      default: return 3600;
    }
  }

  // Filtrar las velas para mostrar solo el último año hasta la fecha actual
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 365 * 24 * 60 * 60;
  const candles1y = useMemo(() => {
    return candles.filter(c => c.time >= oneYearAgo && c.time <= now);
  }, [candles, now]);

  // 2. Hook de gráficos
  const { chartContainerRef, rsiContainerRef, macdContainerRef } = useMarketCharts({
    candles: candles1y,
    ema20,
    ema50,
    sma200,
    rsi14,
    macdLine,
    macdSignal,
    macdHistogram,
    signals,
    divergences, // <-- asegúrate que viene desde useMarketData
    settings,
  });

  const lastSignalRef = useRef(0);

  // Estado para soportes detectados
  const [supportLevels, setSupportLevels] = useState([]);
  const [resistanceLevels, setResistanceLevels] = useState([]);

    //Detectar soportes automáticos (mínimos locales)
  useEffect(() => {
    if (!candles1y || !candles1y.length) return;

    const localMinSupports = [];
    for (let i = 2; i < candles1y.length - 2; i++) {
      const prev = candles1y[i - 1].low;
      const curr = candles1y[i].low;
      const next = candles1y[i + 1].low;
      if (curr < prev && curr < next) {
        localMinSupports.push(curr);
      }
    }

    const uniqueSupports = [...new Set(localMinSupports)]
      .sort((a, b) => a - b)
      .slice(0, 3);

    setSupportLevels(uniqueSupports);
  }, [candles1y]);

  //Detectar resistencias automáticas (máximos locales)
    useEffect(() => {
    if (!candles1y || !candles1y.length) return;
    const localMaxResistances = [];
    for (let i = 2; i < candles1y.length - 2; i++) {
      const prev = candles1y[i - 1].high;
      const curr = candles1y[i].high;
      const next = candles1y[i + 1].high;
      if (curr > prev && curr > next) localMaxResistances.push(curr);
    }
    const uniqueResistances = [...new Set(localMaxResistances)].sort((a, b) => b - a).slice(0, 3);
    setResistanceLevels(uniqueResistances);
  }, [candles1y]);

  useEffect(() => {
    if (!candles1y || !candles1y.length) return;
    const localMaxResistances = [];
    for (let i = 2; i < candles1y.length - 2; i++) {
      const prev = candles1y[i - 1].high;
      const curr = candles1y[i].high;
      const next = candles1y[i + 1].high;
      if (curr > prev && curr > next) localMaxResistances.push(curr);
    }
    const uniqueResistances = [...new Set(localMaxResistances)].sort((a, b) => b - a).slice(0, 3);
    setResistanceLevels(uniqueResistances);
  }, [candles1y]);

  //Dibujar líneas horizontales de soporte en el gráfico


  useEffect(() => {
    if (!chartContainerRef?.current || (!supportLevels.length && !resistanceLevels.length)) return;
    const chartInstance =
      chartContainerRef.current?.chart ||
      chartContainerRef.current?._chart ||
      chartContainerRef.current?.chartRef?.current ||
      null;
    if (!chartInstance) {
      console.warn('No se pudo acceder a la serie de precios principal.');
      return;
    }

    const series = [];

    // 🔹 Soportes (líneas verdes)
    supportLevels.forEach((level) => {
      const lineSeries = chartInstance.addLineSeries({
        color: '#00FF00',
        lineWidth: 2,
        lineStyle: 2,
      });
      lineSeries.setData([
        { time: candles1y[0].time, value: level },
        { time: candles1y[candles1y.length - 1].time, value: level },
      ]);
      series.push(lineSeries);
    });

    // 🔹 Resistencias (líneas rojas)
    resistanceLevels.forEach((level) => {
      const lineSeries = chartInstance.addLineSeries({
        color: '#FF0000',
        lineWidth: 2,
        lineStyle: 2,
      });
      lineSeries.setData([
        { time: candles1y[0].time, value: level },
        { time: candles1y[candles1y.length - 1].time, value: level },
      ]);
      series.push(lineSeries);
    });

    console.log('✅ Soportes:', supportLevels);
    console.log('✅ Resistencias:', resistanceLevels);

    return () => {
      series.forEach((l) => chartInstance.removeSeries(l));
    };
  }, [chartContainerRef, supportLevels, resistanceLevels, candles1y]);

  // Efecto para conectar el scroll/zoom del gráfico con la carga automática de velas
  useEffect(() => {
    if (!chartContainerRef || !chartContainerRef.current) return;
    let chartInstance = chartContainerRef.current?.chartRef?.current || chartContainerRef.current._chartRef?.current || chartContainerRef.current._chart || null;
    if (!chartInstance) {
      const timer = setTimeout(() => {
        chartInstance = chartContainerRef.current?.chartRef?.current || chartContainerRef.current._chartRef?.current || chartContainerRef.current._chart || null;
        if (chartInstance) attachListener(chartInstance);
      }, 500);
      return () => clearTimeout(timer);
    }
    attachListener(chartInstance);

    function attachListener(chart) {
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (!candles.length) return;
        const minIndex = range?.from ?? 0;
        if (minIndex < 10) {
          loadMoreCandles();
        }
      });
    }
    // Cleanup
    return () => {
      if (chartInstance) {
        chartInstance.timeScale().unsubscribeVisibleLogicalRangeChange();
      }
    };
  }, [chartContainerRef, candles, interval]);

  useEffect(() => {
    if (!tradeSignals.length) return;

    const lastKnown = lastSignalRef.current;
    const newestTimestamp = tradeSignals[tradeSignals.length - 1].time;
    lastSignalRef.current = Math.max(lastKnown, newestTimestamp);

    const freshSignals = tradeSignals.filter((signal) => signal.time > lastKnown);
    if (!freshSignals.length) return;

    const strategyKey = getStrategyKey(selectedStrategy);
    const strategyCode =
      selectedStrategy?.strategy_code ||
      selectedStrategy?.name ||
      'FRONTEND_MACD_RSI';

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
      strategyId: strategyKey,
      strategyCode,
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
      persistTradeSignals(batch, {
        symbol,
        interval: intervalLabel,
        mode: tradeMode,
        strategyCode,
      })
        .then(({ persisted, errors }) => {
          console.log(`✓ ${persisted} señales guardadas`);
          if (errors.length) {
            console.warn('[signals] errores al persistir:', errors);
            setError(`Algunas señales no se pudieron guardar: ${errors.length} fallos`);
          }
        })
        .catch((err) => {
          console.error('[signals] persistencia fallida:', err?.message);
          setError('Error al guardar señales de trading');
        });
    }
  }, [tradeSignals, tradeMode, symbol, intervalLabel, selectedStrategy]);

  const handleSymbolPreset = (event) => {
    setSymbol(event.target.value);
    setCustomTicker('');
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
        <div className="intervals-section">
          <label className="section-label">
            <span className="label-icon">⏱️</span>
            Intervalo de Tiempo
          </label>
          <div className="intervals-grid">
            <div className="interval-group">
              <span className="group-label">Largo Plazo</span>
              <div className="interval-buttons">
                {INTERVALS.filter(itv => itv.group === 'largo').map((itv) => (
                  <button
                    key={itv.value}
                    type="button"
                    className={interval === itv.value ? 'active' : ''}
                    onClick={() => setInterval(itv.value)}
                    title={itv.fullLabel}
                  >
                    {itv.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="interval-group">
              <span className="group-label">Mediano Plazo</span>
              <div className="interval-buttons">
                {INTERVALS.filter(itv => itv.group === 'medio').map((itv) => (
                  <button
                    key={itv.value}
                    type="button"
                    className={interval === itv.value ? 'active' : ''}
                    onClick={() => setInterval(itv.value)}
                    title={itv.fullLabel}
                  >
                    {itv.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="interval-group">
              <span className="group-label">Corto Plazo</span>
              <div className="interval-buttons">
                {INTERVALS.filter(itv => itv.group === 'corto').map((itv) => (
                  <button
                    key={itv.value}
                    type="button"
                    className={interval === itv.value ? 'active' : ''}
                    onClick={() => setInterval(itv.value)}
                    title={itv.fullLabel}
                  >
                    {itv.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="strategy-section">
          <label className="section-label">
            <span className="label-icon">🧠</span>
            Estrategia de trading
          </label>
          <div className="strategy-selector">
            <select
              value={selectedStrategyId}
              onChange={(event) => setSelectedStrategyId(event.target.value)}
              disabled={strategiesLoading || !strategies.length}
            >
              {(!strategies.length) && (
                <option value="">
                  {strategiesLoading ? 'Cargando estrategias...' : 'Sin estrategias registradas'}
                </option>
              )}
              {strategies.map((strategy, index) => {
                const value = getStrategyKey(strategy) || `strategy-${index}`;
                const label = strategy.name || strategy.strategy_code || value;
                const suffix =
                  strategy.name && strategy.strategy_code ? ` (${strategy.strategy_code})` : '';
                return (
                  <option key={value} value={value}>
                    {label}
                    {suffix}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              className="btn-secondary"
              aria-label="Refrescar estrategias"
              onClick={loadStrategies}
              disabled={strategiesLoading}
            >
              {strategiesLoading ? 'Actualizando...' : 'Refrescar'}
            </button>
          </div>
          {strategiesError && <p className="strategy-status error">{strategiesError}</p>}
        </div>

        <div className="strategy-summary">
          <div>
            <strong>Indicadores activos</strong>
            <div className="indicator-pill-group">
              {indicatorBadges.length ? (
                indicatorBadges.map(({ key, label, icon }) => (
                  <span key={key} className="indicator-pill">
                    <span className="toggle-icon">{icon}</span>
                    {label}
                  </span>
                ))
              ) : (
                <span className="indicator-pill muted">Sin indicadores</span>
              )}
            </div>
          </div>
          <div>
            <strong>Configuración de señales</strong>
            <span className="strategy-signal-summary">
              RSI {signalConfig.rsiOversold}/{signalConfig.rsiOverbought} · MACD ≥{' '}
              {signalConfig.macdHistogramThreshold} · {signalConfig.minReasons}+ razones
            </span>
          </div>
        </div>

        <div className="controls-divider"></div>

        <div className="signal-config">
          <label className="section-label">
            <span className="label-icon">⚙️</span>
            Configuración de ejecución
          </label>
          <div className="trade-mode">
            <span className="mode-label">Modo de Trading:</span>
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
          {candles.length > 0 && (() => {
            const firstTime = new Date(candles[0].time * 1000);
            const lastTime = new Date(candles[candles.length - 1].time * 1000);
            const daysCovered = Math.round((lastTime - firstTime) / (1000 * 60 * 60 * 24));
            const formatDate = (date) => {
              return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
            };
            return (
              <span style={{ marginLeft: '8px', color: '#888', fontSize: '0.9em' }}>
                ({daysCovered} días: {formatDate(firstTime)} - {formatDate(lastTime)})
              </span>
            );
          })()}
        </div>
        <div>
          <strong>Volumen ultimo:</strong> {volumeLabel}
        </div>
        {supportLevels.length > 0 && (
          <div className="support-info">
            <strong>Soportes detectados:</strong>{' '}
            {supportLevels.map((lvl) => lvl.toFixed(2)).join(', ')}
          </div>
        )}
        {resistanceLevels.length > 0 && (
          <div className="resistance-info">
            <strong>Resistencias detectadas:</strong>{' '}
            {resistanceLevels.map((lvl) => lvl.toFixed(2)).join(', ')}
          </div>
)}

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

