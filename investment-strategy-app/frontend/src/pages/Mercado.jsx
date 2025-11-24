// src/pages/Mercado.jsx
// ---------------------------------------------------------
// Pantalla principal de "Mercado":
// - Orquesta datos de mercado, estrategias, gráficos y señales.
// - Utiliza hooks personalizados y subcomponentes para mantener
//   el código organizado y fácil de mantener.
// ---------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';

// Componentes de UI
import Notification from '../components/Notification';
import MarketHeader from '../components/market/MarketHeader';
import MarketConfigPanel from '../components/market/MarketConfigPanel';
import MarketChartsContainer from '../components/market/MarketChartsContainer';
import MarketSummary from '../components/market/MarketSummary';
import EventsTable from '../components/market/EventsTable';
import NotificationTray from '../components/market/NotificationTray';

// Hooks personalizados
import { useMarketData } from '../hooks/useMarketData';
import { useMarketCharts } from '../hooks/useMarketCharts';
import { useStrategies } from '../hooks/useStrategies';
import { useSupportResistance } from '../hooks/useSupportResistance';
import { useMarketAutoload } from '../hooks/useMarketAutoload';
import { useTradeSignalNotifications } from '../hooks/useTradeSignalNotifications';

// Constantes y configuraciones
import { DEFAULT_SYMBOLS } from '../services/marketData';
import { INTERVALS, TRADE_MODES } from '../constants/marketConstants';
import { DEFAULT_INDICATOR_SETTINGS } from '../constants/strategyProfiles';

// Utilidades
import { 
  getIntervalLabel,
  getLimitForInterval,
  filterCandlesLastYear
} from '../utils/marketUtils';
import { 
  getStrategyConfig,
  mergeSignalConfig,
  prepareIndicatorsForEvents
} from '../utils/strategyConfig';
import { buildEvents } from '../utils/events';

// Estilos
import '../assets/css/Mercado.css';
import '../assets/globalAssets.css';

/**
 * Componente principal: Mercado
 *
 * Responsabilidad:
 *  - Gestionar el estado actual del símbolo, intervalo, estrategia y configuración.
 *  - Invocar hooks de datos y gráficos.
 *  - Administrar notificaciones (pop-ups y bandeja).
 *  - Renderizar los gráficos + tabla de eventos + resumen de mercado.
 */
const Mercado = () => {
  // -------------------------------------------------------
  // 1. ESTADO PRINCIPAL DE LA PANTALLA
  // -------------------------------------------------------
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOLS[0]?.value || 'I:NDX');
  const [interval, setInterval] = useState(INTERVALS[0].value);
  const [customTicker, setCustomTicker] = useState('');
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_INDICATOR_SETTINGS }));
  const [tradeMode, setTradeMode] = useState(TRADE_MODES.notify);
  const [strategySignalConfig, setStrategySignalConfig] = useState({});

  // -------------------------------------------------------
  // 2. HOOK DE ESTRATEGIAS
  // -------------------------------------------------------
  const {
    strategies,
    selectedStrategyId,
    setSelectedStrategyId,
    selectedStrategy,
    strategiesLoading,
    strategiesError,
    loadStrategies
  } = useStrategies();

  // -------------------------------------------------------
  // 3. HIDRATACIÓN DE CONFIGURACIÓN DE ESTRATEGIA
  // -------------------------------------------------------
  useEffect(() => {
    const { indicatorSettings, signalConfig: cfg } = getStrategyConfig(selectedStrategy);
    setSettings(indicatorSettings);
    setStrategySignalConfig(cfg);
  }, [selectedStrategy]);

  // -------------------------------------------------------
  // 4. MERGE DE CONFIGURACIÓN DE SEÑALES
  // -------------------------------------------------------
  const signalConfig = useMemo(
    () => mergeSignalConfig(strategySignalConfig, settings),
    [strategySignalConfig, settings],
  );

  const intervalLabel = getIntervalLabel(interval);
  const [limit, setLimit] = useState(() => getLimitForInterval(interval));

  useEffect(() => {
    setLimit(getLimitForInterval(interval));
  }, [interval]);

  // -------------------------------------------------------
  // 5. HOOK PRINCIPAL DE DATOS DE MERCADO
  // -------------------------------------------------------
  const {
    candles,        // Velas crudas
    loading,        // Estado de carga de datos
    error,          // Mensaje de error si falla la carga
    ema20,          // Serie EMA20
    ema50,          // Serie EMA50
    sma200,         // Serie SMA200
    rsi14,          // Serie RSI 14
    macdLine,       // Línea principal MACD
    macdSignal,     // Línea señal MACD
    macdHistogram,  // Histograma MACD
    signals,        // Señales de indicadores (no necesariamente trade)
    tradeSignals,   // Señales de trading (BUY/SELL) ya procesadas
    divergences,    // Divergencias detectadas por backend o lógica interna
    bbMiddle,       // Banda media de Bollinger
    bbUpper,        // Banda superior de Bollinger
    bbLower,      // Banda inferior de Bollinger
    bbMetric,     // Métrica adicional de Bollinger (e.g., BandWidth)
  } = useMarketData({
    symbol,
    interval,
    limit,
    signalConfig,
    datasetId: selectedStrategy?.dataset_id?.ID || selectedStrategy?.dataset_id?._id || selectedStrategy?.dataset_id,
    strategyCode: selectedStrategy?.strategy_code,
    periodStart: selectedStrategy?.period_start,
    periodEnd: selectedStrategy?.period_end,
  });

  // -------------------------------------------------------
  // 6. FUNCIÓN PARA CARGAR MÁS VELAS HACIA ATRÁS (AUTOLOAD)
  // -------------------------------------------------------
  const loadMoreCandles = useCallback(() => {
    setLimit((prev) => {
      const increment = getLimitForInterval(interval);
      const next = prev + increment;
      // Cap para evitar pedir demasiadas velas de una sola vez
      return Math.min(next, 10000);
    });
  }, [interval]);

  // -------------------------------------------------------
  // 7. FILTRO: SOLO VELAS DEL ÚLTIMO AÑO (PARA GRÁFICOS/EVENTOS)
  // -------------------------------------------------------
  const candlesLastYear = useMemo(() => filterCandlesLastYear(candles), [candles]);

  // -------------------------------------------------------
  // 8. PREPARAR INDICADORES EN FORMATOS SIMPLES PARA EVENTOS
  // -------------------------------------------------------
  const indicatorsForEvents = useMemo(
    () => prepareIndicatorsForEvents({ ema20, ema50, rsi14, macdLine, macdSignal, macdHistogram }),
    [ema20, ema50, rsi14, macdLine, macdSignal, macdHistogram]
  );

  // -------------------------------------------------------
  // 9. CONSTRUCCIÓN DE EVENTOS (RSI, MACD, DIVERGENCIAS, ETC.)
  // -------------------------------------------------------
  const events = useMemo(() => {
    if (!candlesLastYear || !candlesLastYear.length) return [];

    return buildEvents({
      candles: candlesLastYear,
      indicators: indicatorsForEvents,
      divergences,
      signals,
      cfg: {
        rsiOversold: signalConfig.rsiOversold,
        rsiOverbought: signalConfig.rsiOverbought,
        confirmBars: 1,
        cooldownBars: 5,
      },
    });
  }, [candlesLastYear, indicatorsForEvents, divergences, signals, signalConfig]);

  // -------------------------------------------------------
  // 10. CONFIGURACIÓN E INICIALIZACIÓN DE GRÁFICOS
  // -------------------------------------------------------
  const shouldInitializeCharts =
    Array.isArray(candlesLastYear) && candlesLastYear.length > 0 && !loading;
  
  const { 
    chartContainerRef,  // ref del contenedor del gráfico principal
    rsiContainerRef,    // ref contenedor gráfico RSI
    macdContainerRef,   // ref contenedor gráfico MACD
    bbContainerRef,     // ref contenedor gráfico BB
    chartRef,           // referencia a la instancia del chart (para timeScale, etc.)
    candleSeriesRef     // referencia a la serie de velas
  } = useMarketCharts({
    candles:        shouldInitializeCharts ? candlesLastYear : [],
    ema20:          shouldInitializeCharts ? ema20 : [],
    ema50:          shouldInitializeCharts ? ema50 : [],
    sma200:         shouldInitializeCharts ? sma200 : [],
    rsi14:          shouldInitializeCharts ? rsi14 : [],
    macdLine:       shouldInitializeCharts ? macdLine : [],
    macdSignal:     shouldInitializeCharts ? macdSignal : [],
    macdHistogram:  shouldInitializeCharts ? macdHistogram : [],
    signals:        shouldInitializeCharts ? signals : [],
    divergences:    shouldInitializeCharts ? divergences : [],
    bbMiddle:       shouldInitializeCharts ? bbMiddle : [],   
    bbUpper:        shouldInitializeCharts ? bbUpper : [],    
    bbLower:        shouldInitializeCharts ? bbLower : [],     
    bbMetric:       shouldInitializeCharts ? bbMetric : [],
    settings,
  });

  // -------------------------------------------------------
  // 11. SOPORTE Y RESISTENCIA (CÁLCULO A PARTIR DE VELAS)
  // -------------------------------------------------------
  const { supportLevels, resistanceLevels } = useSupportResistance(candlesLastYear, chartRef);

  // -------------------------------------------------------
  // 12. AUTOLOAD DE VELAS VIA SCROLL EN EL GRÁFICO
  // -------------------------------------------------------
  useMarketAutoload({
    chartRef,
    candles,
    interval,
    onLoadMore: loadMoreCandles,
  });

  // -------------------------------------------------------
  // 13. PROCESAMIENTO DE SEÑALES DE TRADING
  // -------------------------------------------------------
  const { notifications, popup, closePopup } = useTradeSignalNotifications({
    tradeSignals,
    tradeMode,
    symbol,
    intervalLabel,
    selectedStrategy,
  });

  // -------------------------------------------------------
  // 14. HANDLERS PARA TICKER PERSONALIZADO
  // -------------------------------------------------------
  const handleCustomTickerLoad = useCallback((ticker) => {
    setSymbol(ticker);
    setCustomTicker('');
  }, []);

  const handleCustomTickerChange = useCallback((value) => {
    setCustomTicker(value);
  }, []);

  // -------------------------------------------------------
  // 15. RENDER DEL COMPONENTE
  // -------------------------------------------------------
  return (
    <div className="page-mercado">
      {/* Popup general de notificaciones */}
      <Notification
        message={popup.message}
        open={popup.open}
        onClose={closePopup}
      />

      {/* Header con selector de símbolo y ticker personalizado */}
      <MarketHeader
        symbol={symbol}
        onSymbolChange={setSymbol}
        customTicker={customTicker}
        onCustomTickerChange={handleCustomTickerChange}
        onLoadCustomTicker={handleCustomTickerLoad}
      />

      {/* Panel de configuración: intervalo, estrategia y modo de trading */}
      <MarketConfigPanel
        interval={interval}
        onIntervalChange={setInterval}
        strategies={strategies}
        selectedStrategyId={selectedStrategyId}
        onStrategyChange={setSelectedStrategyId}
        strategiesLoading={strategiesLoading}
        strategiesError={strategiesError}
        onRefreshStrategies={loadStrategies}
        settings={settings}
        signalConfig={signalConfig}
        tradeMode={tradeMode}
        onTradeModeChange={setTradeMode}
        error={error}
      />

      {/* Contenedor de gráficos: precio, RSI y MACD */}
      <MarketChartsContainer
        chartContainerRef={chartContainerRef}
        rsiContainerRef={rsiContainerRef}
        macdContainerRef={macdContainerRef}
        bbContainerRef={bbContainerRef}
        loading={loading}
        error={error}
        candles={candles}
        rsi14={rsi14}
        macdLine={macdLine}
        settings={settings}
      />

      {/* Resumen de mercado + niveles de soporte/resistencia */}
      <MarketSummary
        symbol={symbol}
        interval={interval}
        candles={candles}
        supportLevels={supportLevels}
        resistanceLevels={resistanceLevels}
      />

      {/* Tabla de eventos (divergencias, alertas RSI/MACD, etc.) */}
      <EventsTable 
        events={events} 
        symbol={symbol} 
        candles={candlesLastYear} 
        signalConfig={signalConfig}
        settings={settings}
        ema20={ema20}
        ema50={ema50}
        macdLine={macdLine}
        macdSignal={macdSignal}
        macdHistogram={macdHistogram}
      />

      {/* Bandeja de notificaciones históricas de señales */}
      <NotificationTray
        notifications={notifications}
        tradeMode={tradeMode}
      />
    </div>
  );
};

export default Mercado;
