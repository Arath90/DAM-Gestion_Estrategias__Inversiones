import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Notification from '../components/Notification';
import MarketHeader from '../components/market/MarketHeader';
import IntervalSelector from '../components/market/IntervalSelector';
import StrategySelector from '../components/market/StrategySelector';
import TradingControls from '../components/market/TradingControls';
import MarketSummary from '../components/market/MarketSummary';
import NotificationTray from '../components/market/NotificationTray';
import { DEFAULT_SYMBOLS } from '../services/marketData';
import { persistTradeSignals } from '../services/tradingSignals';
import { useMarketData } from '../hooks/useMarketData';
import { useMarketCharts } from '../hooks/useMarketCharts';
import { useStrategies } from '../hooks/useStrategies';
import { useSupportResistance } from '../hooks/useSupportResistance';
import { 
  DEFAULT_INDICATOR_SETTINGS,
  DEFAULT_SIGNAL_CONFIG,
  hydrateStrategyProfile,
} from '../constants/strategyProfiles';
import { INTERVALS, TRADE_MODES } from '../constants/marketConstants';
import { 
  buildToastMessage,
  getStrategyKey,
  getIntervalLabel,
  getLimitForInterval,
  getSecondsPerCandle,
  formatConfidence,
  generateYearRange,
  filterCandlesLastYear
} from '../utils/marketUtils';
import '../assets/css/Mercado.css';
import '../assets/globalAssets.css';


//Codigo agregado por Andrick y chat
import { buildEvents } from '../utils/events'; // o './utils/events' según tu alias
import EventsTable from '../components/market/EventsTable';


/**
 * Pantalla Mercado.
 * Orquesta el flujo completo de datos -> gráficos -> acciones:
 *  - usa `useMarketData` para obtener velas, indicadores y señales personalizadas,
 *  - delega la visualización en `useMarketCharts`,
 *  - gestiona el modo de ejecución (auto o avisos) y publica cada señal en
 *    pop-ups (Notification.jsx) y en la bandeja histórica del panel.
 */
const Mercado = () => {
  // Estados principales
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOLS[0]?.value || 'I:NDX');
  const [interval, setInterval] = useState(INTERVALS[0].value);
  const [customTicker, setCustomTicker] = useState('');
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_INDICATOR_SETTINGS }));
  const [tradeMode, setTradeMode] = useState(TRADE_MODES.notify);
  const [strategySignalConfig, setStrategySignalConfig] = useState(() => ({ ...DEFAULT_SIGNAL_CONFIG }));
  const [notifications, setNotifications] = useState([]);
  const [popup, setPopup] = useState({ open: false, message: '' });

  // Hooks de estrategias
  const {
    strategies,
    selectedStrategyId,
    setSelectedStrategyId,
    selectedStrategy,
    strategiesLoading,
    strategiesError,
    loadStrategies
  } = useStrategies();

  // Configuración derivada de la estrategia seleccionada
  useEffect(() => {
    const { indicatorSettings, signalConfig: cfg } = hydrateStrategyProfile(selectedStrategy);
    setSettings(indicatorSettings);
    setStrategySignalConfig(cfg);
  }, [selectedStrategy]);

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

  const intervalLabel = getIntervalLabel(interval);
  const limit = useMemo(() => getLimitForInterval(interval), [interval]);
  
  const [range, setRange] = useState(generateYearRange);

  // Datos del mercado
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
    limit,
    signalConfig,
  });

  // Función para cargar más velas hacia atrás
  const loadMoreCandles = useCallback(() => {
    setRange((prev) => ({
      from: prev.from - limit * getSecondsPerCandle(interval),
      to: prev.to,
    }));
  }, [limit, interval]);

  // Filtrar las velas para mostrar solo el último año hasta la fecha actual
  const candles1y = useMemo(() => filterCandlesLastYear(candles), [candles]);

  const indicatorsForEvents = useMemo(() => {
  // Convertir a arrays simples alineados por índice si es necesario
  return {
    ema20: (ema20 || []).map(e => e?.value ?? null),
    ema50: (ema50 || []).map(e => e?.value ?? null),
    rsi: (rsi14 || []).map(r => r?.value ?? null),
    macd: {
      macd: (macdLine || []).map(m => m?.value ?? null),
      signal: (macdSignal || []).map(s => s?.value ?? null),
      hist: (macdHistogram || []).map(h => h?.value ?? null),
    },
    // si calculas bollinger, ponlo aquí: bb: { upper:[], lower:[] }
  };
}, [ema20, ema50, rsi14, macdLine, macdSignal, macdHistogram]);

const events = useMemo(() => {
  if (!candles1y || !candles1y.length) return [];
  return buildEvents({
    candles: candles1y,
    indicators: indicatorsForEvents,
    divergences,
    cfg: { rsiOversold: signalConfig.rsiOversold, rsiOverbought: signalConfig.rsiOverbought }
  });
}, [candles1y, indicatorsForEvents, divergences, signalConfig]);

  // Mostrar error destacado si no hay datos
  const renderError = error && (
    <div style={{ 
      background: '#fee2e2', 
      color: '#b91c1c', 
      padding: '16px', 
      borderRadius: '8px', 
      margin: '16px 0', 
      textAlign: 'center', 
      fontWeight: 'bold', 
      fontSize: '1.1em' 
    }}>
      {error}
    </div>
  );

  // Gráficos (solo se inicializa cuando hay datos válidos)
  const shouldInitializeCharts = Array.isArray(candles1y) && candles1y.length > 0 && !loading;
  
  const { 
    chartContainerRef, 
    rsiContainerRef, 
    macdContainerRef,
    chartRef, 
    candleSeriesRef 
  } = useMarketCharts({
    candles: shouldInitializeCharts ? candles1y : [],
    ema20: shouldInitializeCharts ? ema20 : [],
    ema50: shouldInitializeCharts ? ema50 : [],
    sma200: shouldInitializeCharts ? sma200 : [],
    rsi14: shouldInitializeCharts ? rsi14 : [],
    macdLine: shouldInitializeCharts ? macdLine : [],
    macdSignal: shouldInitializeCharts ? macdSignal : [],
    macdHistogram: shouldInitializeCharts ? macdHistogram : [],
    signals: shouldInitializeCharts ? signals : [],
    divergences: shouldInitializeCharts ? divergences : [],
    settings,
  });

  // Hook de soporte y resistencia
  const { supportLevels, resistanceLevels } = useSupportResistance(candles1y, chartRef);

  // Lógica de autoload y señales
  const lastSignalRef = useRef(0);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const autoLoadTimeoutRef = useRef();

  // Efecto para conectar el scroll/zoom del gráfico con la carga automática de velas
  useEffect(() => {
    if (!chartRef || !candles.length || isAutoLoading) return;
    
    console.log('[AutoLoad] Configurando listener de scroll/zoom para carga automática');
    
    const unsubscribe = chartRef.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!candles.length || isAutoLoading) return;
      
      const minIndex = range?.from ?? 0;
      const totalCandles = candles.length;
      
      // Solo cargar más velas si estamos cerca del inicio
      if (minIndex < 5 && totalCandles >= 50) {
        console.log(`[AutoLoad] Cerca del inicio (${minIndex}), cargando más velas... Total actual: ${totalCandles}`);
        
        setIsAutoLoading(true);
        
        if (autoLoadTimeoutRef.current) {
          clearTimeout(autoLoadTimeoutRef.current);
        }
        
        autoLoadTimeoutRef.current = setTimeout(() => {
          loadMoreCandles();
          setTimeout(() => setIsAutoLoading(false), 2000);
        }, 1000);
      }
    });
    
    return () => {
      try {
        if (autoLoadTimeoutRef.current) {
          clearTimeout(autoLoadTimeoutRef.current);
        }
        unsubscribe();
      } catch (e) {
        console.debug('[AutoLoad] Error al desuscribirse:', e.message);
      }
    };
  }, [chartRef, candles.length, isAutoLoading, loadMoreCandles]);

  // Procesamiento de señales de trading
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
          }
        })
        .catch((err) => {
          console.error('[signals] persistencia fallida:', err?.message);
        });
    }
  }, [tradeSignals, tradeMode, symbol, intervalLabel, selectedStrategy]);

  // Handlers para los componentes
  const handleCustomTickerLoad = useCallback((ticker) => {
    setSymbol(ticker);
    setCustomTicker('');
  }, []);

  const handleCustomTickerChange = useCallback((value) => {
    setCustomTicker(value);
  }, []);

  return (
    <div className="page-mercado">
      <Notification
        message={popup.message}
        open={popup.open}
        onClose={() => setPopup({ open: false, message: '' })}
      />

      <MarketHeader
        symbol={symbol}
        onSymbolChange={setSymbol}
        customTicker={customTicker}
        onCustomTickerChange={handleCustomTickerChange}
        onLoadCustomTicker={handleCustomTickerLoad}
      />

      <section className="market-controls">
        {renderError}
        
        <IntervalSelector
          interval={interval}
          onIntervalChange={setInterval}
        />

        <StrategySelector
          strategies={strategies}
          selectedStrategyId={selectedStrategyId}
          onStrategyChange={setSelectedStrategyId}
          strategiesLoading={strategiesLoading}
          strategiesError={strategiesError}
          onRefreshStrategies={loadStrategies}
          settings={settings}
          signalConfig={signalConfig}
        />

        <div className="controls-divider"></div>

        <TradingControls
          tradeMode={tradeMode}
          onTradeModeChange={setTradeMode}
        />
      </section>

      <section className="market-chart-wrapper">
        <div className="market-chart" ref={chartContainerRef}>
          <div className="chart-title" title="Velas, volumen e indicadores seleccionados.">
            Precio y señales
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
              <div className="chart-overlay info">RSI requiere más historial.</div>
            )}
          </div>
        )}
        {settings.macd && (
          <div className="market-chart macd-chart" ref={macdContainerRef}>
            <div className="chart-title" title="MACD, línea de señal e histograma.">
              MACD
            </div>
            {loading && <div className="chart-overlay">Calculando MACD...</div>}
            {!loading && !macdLine.length && (
              <div className="chart-overlay info">MACD requiere más historial.</div>
            )}
          </div>
        )}

        
      </section>

      <MarketSummary
        symbol={symbol}
        interval={interval}
        candles={candles}
        supportLevels={supportLevels}
        resistanceLevels={resistanceLevels}

        
      />
      <EventsTable events={events} symbol={symbol} />
      <NotificationTray
        notifications={notifications}
        tradeMode={tradeMode}
      />

      
    </div>
    
  );
};

export default Mercado;