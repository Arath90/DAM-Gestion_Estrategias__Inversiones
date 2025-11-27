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
// Conjunto de símbolos por defecto para iniciar la pantalla
//import { DEFAULT_SYMBOLS, fetchAnalytics } from '../services/marketData';

// Servicio para persistir señales de trading en backend

// Hook principal para cargar datos de mercado + indicadores + señales
import { useMarketData } from '../hooks/useMarketData';
import { useMarketCharts } from '../hooks/useMarketCharts';
import { useStrategies } from '../hooks/useStrategies';
import { useSupportResistance } from '../hooks/useSupportResistance';
import { useMarketAutoload } from '../hooks/useMarketAutoload';
import { useTradeSignalNotifications } from '../hooks/useTradeSignalNotifications';

// Constantes y configuraciones
import { DEFAULT_SYMBOLS } from '../services/marketData';
// Configuraciones por defecto de indicadores y se?ales de estrategias
import { DEFAULT_INDICATOR_SETTINGS } from '../constants/strategyProfiles';
import { DEFAULT_ALGORITHM_PARAMS } from '../constants/algorithmDefaults';

// Constantes de mercados: intervalos posibles y modos de trading
import { INTERVALS, TRADE_MODES } from '../constants/marketConstants';

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
import { InstrumentsAPI } from '../services/odata';

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

  const [instrumentId, setInstrumentId] = useState('');
  const [instrumentLookup, setInstrumentLookup] = useState(false);
  const [instrumentError, setInstrumentError] = useState('');
  const [savingStrongSignals, setSavingStrongSignals] = useState(false);

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

  useEffect(() => {
    let alive = true;
    const fetchInstrument = async () => {
      if (!symbol) {
        setInstrumentId('');
        setInstrumentError('');
        return;
      }

      setInstrumentLookup(true);
      setInstrumentError('');
      try {
        const escapedSymbol = String(symbol).replace(/'/g, "''");
        const records = await InstrumentsAPI.list({
          top: 1,
          filter: `symbol eq '${escapedSymbol}'`,
        });
        if (!alive) return;
        const entry = Array.isArray(records) ? records[0] : records;
        const resolvedId = entry?.ID || entry?.id || entry?._id || '';
        if (resolvedId) {
          setInstrumentId(String(resolvedId));
          setInstrumentError('');
        } else {
          setInstrumentId('');
          setInstrumentError('Instrumento no registrado en el catálogo.');
        }
      } catch (err) {
        if (!alive) return;
        setInstrumentId('');
        setInstrumentError('No se pudo resolver el instrumento para el símbolo seleccionado.');
      } finally {
        if (alive) setInstrumentLookup(false);
      }
    };

    fetchInstrument();
    return () => {
      alive = false;
    };
  }, [symbol]);

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
                    //Pasar las bandas a useMarketData
    bbMiddle,
    bbUpper,
    bbLower,
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

  const strongSignalHint = instrumentLookup
    ? 'Buscando identificador del instrumento...'
    : instrumentId
    ? `Se guardar?n las strong signals de ${symbol}.`
    : instrumentError || 'Instrumento no encontrado en el cat?logo.';

  const canSaveStrongSignals = useMemo(
    () => Boolean(!loading && instrumentId && candles.length && !instrumentLookup),
    [loading, instrumentId, candles.length, instrumentLookup],
  );


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

  const handleSaveStrongSignals = useCallback(async () => {
    if (!instrumentId) {
      setPopup({
        open: true,
        message: instrumentError || 'Selecciona un s?mbolo registrado para guardar strong signals.',
      });
      return;
    }
    if (!candles.length) {
      setPopup({
        open: true,
        message: 'No hay velas suficientes para generar se?ales.',
      });
      return;
    }

    setSavingStrongSignals(true);
    try {
      await fetchAnalytics({
        candles,
        params: {
          signalConfig,
          algoParams: DEFAULT_ALGORITHM_PARAMS,
          symbol,
          interval,
          instrument_id: instrumentId,
          persistStrong: true,
          timeframe: interval,
          minStrongScore: strategySignalConfig?.minStrongScore ?? 0.75,
          minStrongPriceDeltaPct: strategySignalConfig?.minStrongPriceDeltaPct ?? 1,
        },
      });
      setPopup({
        open: true,
        message: 'Strong signals guardadas en Cosmos DB.',
      });
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'No se pudieron guardar las strong signals.';
      setPopup({ open: true, message });
    } finally {
      setSavingStrongSignals(false);
    }
  }, [
    instrumentId,
    candles,
    signalConfig,
    interval,
    symbol,
    strategySignalConfig,
    instrumentError,
  ]);


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
    settings,
    //Pasarlos a useMarketCharts
    bbMiddle: shouldInitializeCharts ? bbMiddle : [],
    bbUpper:  shouldInitializeCharts ? bbUpper  : [],
    bbLower:  shouldInitializeCharts ? bbLower  : [],
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
        onSaveStrongSignals={handleSaveStrongSignals}
        savingStrongSignals={savingStrongSignals}
        canSaveStrongSignals={canSaveStrongSignals}
        strongSignalHint={strongSignalHint}
      />

      {/* Contenedor de gráficos: precio, RSI y MACD */}
      <MarketChartsContainer
        chartContainerRef={chartContainerRef}
        rsiContainerRef={rsiContainerRef}
        macdContainerRef={macdContainerRef}
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
        bbMiddle={bbMiddle}
        bbUpper={bbUpper}
        bbLower={bbLower}
        settings={settings}
      />

      {/* Tabla de eventos (divergencias, alertas RSI/MACD, etc.) */}
      <EventsTable 
        events={events}
        symbol={symbol}
        candles={candles}
        signalConfig={signalConfig}
        settings={settings}
        ema20={ema20}
        ema50={ema50}
        macdLine={macdLine}
        macdSignal={macdSignal}
        macdHistogram={macdHistogram}
        bbMiddle={bbMiddle}
        bbUpper={bbUpper}
        bbLower={bbLower}
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
