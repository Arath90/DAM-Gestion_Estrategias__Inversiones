// src/pages/Mercado.jsx
// ---------------------------------------------------------
// Pantalla principal de "Mercado":
// - Orquesta datos de mercado, estrategias, gráficos y señales.
// - Conecta hooks de datos (useMarketData) con hooks de gráficos
//   (useMarketCharts) y componentes de UI (headers, selectors, tablas).
// - También construye "eventos" a partir de indicadores y divergencias
//   para mostrarlos en una tabla.
// ---------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Notificación emergente tipo "toast" (mensaje flotante)
import Notification from '../components/Notification';

// Encabezado con buscador/cambio de símbolo/ticker
import MarketHeader from '../components/market/MarketHeader';

// Selector de intervalos (1m, 5m, 1H, 1D, etc.)
import IntervalSelector from '../components/market/IntervalSelector';

// Selector de estrategia (lista de estrategias configuradas desde backend)
import StrategySelector from '../components/market/StrategySelector';

// Controles de trading (modo auto / notificar, etc.)
import TradingControls from '../components/market/TradingControls';

// Resumen inferior con niveles de soporte/resistencia y datos básicos
import MarketSummary from '../components/market/MarketSummary';

// Bandeja de notificaciones históricas (señales generadas)
import NotificationTray from '../components/market/NotificationTray';

// Conjunto de símbolos por defecto para iniciar la pantalla
import { DEFAULT_SYMBOLS } from '../services/marketData';

// Servicio para persistir señales de trading en backend
import { persistTradeSignals } from '../services/tradingSignals';

// Hook principal para cargar datos de mercado + indicadores + señales
import { useMarketData } from '../hooks/useMarketData';

// Hook que se encarga de inicializar y actualizar los gráficos (lightweight-charts u otro)
import { useMarketCharts } from '../hooks/useMarketCharts';

// Hook para gestionar estrategias (cargar desde API, seleccionar, refrescar)
import { useStrategies } from '../hooks/useStrategies';

// Hook para calcular niveles de soporte y resistencia a partir de las velas
import { useSupportResistance } from '../hooks/useSupportResistance';

// Configuraciones por defecto de indicadores y señales de estrategias
import { 
  DEFAULT_INDICATOR_SETTINGS,
  DEFAULT_SIGNAL_CONFIG,
  hydrateStrategyProfile,
} from '../constants/strategyProfiles';

// Constantes de mercados: intervalos posibles y modos de trading
import { INTERVALS, TRADE_MODES } from '../constants/marketConstants';

// Utilidades varias relacionadas al mercado (etiquetas, límites, formatos)
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

// Estilos específicos de la página de mercado
import '../assets/css/Mercado.css';
import '../assets/globalAssets.css';

// ---------------------------------------------------------
// Código agregado para el módulo de "Eventos" (divergencias, señales, etc.)
// ---------------------------------------------------------
import { buildEvents } from '../utils/events'; // Construye la lista de eventos a partir de indicadores
import EventsTable from '../components/market/EventsTable'; // Tabla que los muestra en la UI

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

  // Símbolo actual seleccionado (ticker). Toma el primero de DEFAULT_SYMBOLS como valor inicial
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOLS[0]?.value || 'I:NDX');

  // Intervalo de tiempo actual (1D, 1H, 5m, etc.)
  const [interval, setInterval] = useState(INTERVALS[0].value);

  // Valor del ticker personalizado que el usuario escribe en el input
  const [customTicker, setCustomTicker] = useState('');

  // Configuración activa de indicadores (EMA20, EMA50, RSI, MACD, etc.)
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_INDICATOR_SETTINGS }));

  // Modo de trading: solo notificar o ejecutar/persistir automáticamente
  const [tradeMode, setTradeMode] = useState(TRADE_MODES.notify);

  // Configuración específica de señales establecida por la estrategia
  const [strategySignalConfig, setStrategySignalConfig] = useState(() => ({ ...DEFAULT_SIGNAL_CONFIG }));

  // Historial de notificaciones que aparecerán en NotificationTray
  const [notifications, setNotifications] = useState([]);

  // Estado de popup flotante (Notification "global" de la parte superior)
  const [popup, setPopup] = useState({ open: false, message: '' });

  // -------------------------------------------------------
  // 2. HOOK DE ESTRATEGIAS (se conecta al backend de strategies)
  // -------------------------------------------------------
  const {
    strategies,          // Lista de todas las estrategias disponibles
    selectedStrategyId,  // ID de la estrategia seleccionada actualmente
    setSelectedStrategyId,
    selectedStrategy,    // Objeto completo de la estrategia seleccionada
    strategiesLoading,   // Loading de la carga de estrategias
    strategiesError,     // Error si hubo fallos en la carga
    loadStrategies       // Función para recargar estrategias desde backend
  } = useStrategies();

  // -------------------------------------------------------
  // 3. EFECTO: CUANDO CAMBIA LA ESTRATEGIA, HIDRATAR CONFIG
  // -------------------------------------------------------
  useEffect(() => {
    // hydrateStrategyProfile toma la estrategia seleccionada
    // y devuelve ajustes de indicadores + config de señales adaptados
    const { indicatorSettings, signalConfig: cfg } = hydrateStrategyProfile(selectedStrategy);

    // Actualiza configuración local de indicadores y señales
    setSettings(indicatorSettings);
    setStrategySignalConfig(cfg);
  }, [selectedStrategy]);

  // -------------------------------------------------------
  // 4. MERGE DE CONFIGURACIÓN DE SEÑALES (DEFAULT + ESTRATEGIA)
  // -------------------------------------------------------
  const signalConfig = useMemo(
    () => ({
      ...DEFAULT_SIGNAL_CONFIG,
      ...strategySignalConfig,
      // Habilita uso de EMA solo si ambas (20 y 50) están activadas
      useEMA: settings.ema20 && settings.ema50,
      useRSI: settings.rsi,
      useMACD: settings.macd,
    }),
    [strategySignalConfig, settings],
  );

  // Etiqueta amigable del intervalo (por ejemplo "1D", "1H")
  const intervalLabel = getIntervalLabel(interval);

  // Cantidad máxima de velas a solicitar según el intervalo
  const limit = useMemo(() => getLimitForInterval(interval), [interval]);
  
  // Rango temporal en segundos (from/to) usado para autoload hacia atrás
  const [range, setRange] = useState(generateYearRange);

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
  } = useMarketData({
    symbol,
    interval,
    limit,
    signalConfig,
  });

  // -------------------------------------------------------
  // 6. FUNCIÓN PARA CARGAR MÁS VELAS HACIA ATRÁS (AUTOLOAD)
  // -------------------------------------------------------
  const loadMoreCandles = useCallback(() => {
    setRange((prev) => ({
      from: prev.from - limit * getSecondsPerCandle(interval),
      to: prev.to,
    }));
  }, [limit, interval]);

  // -------------------------------------------------------
  // 7. FILTRO: SOLO VELAS DEL ÚLTIMO AÑO (PARA GRÁFICOS/EVENTOS)
  // -------------------------------------------------------
  const candles1y = useMemo(() => filterCandlesLastYear(candles), [candles]);

  const highLowPoints = useMemo(() => {
    if (!candles1y || candles1y.length === 0) return { maxPrice: null, minPrice: null };
    const highs = candles1y.map(c => c.high);
    const lows = candles1y.map(c => c.low);
    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    return { maxPrice, minPrice };
  }, [candles1y]);
  // -------------------------------------------------------
  // 8. PREPARAR INDICADORES EN FORMATOS SIMPLES PARA EVENTOS
  //    (arrays de valores alineados con índices de candles1y)
  // -------------------------------------------------------
  const indicatorsForEvents = useMemo(() => {
    // Convertir a arrays simples con valores numéricos o null
    return {
      ema20: (ema20 || []).map(e => e?.value ?? null),
      ema50: (ema50 || []).map(e => e?.value ?? null),
      rsi:   (rsi14 || []).map(r => r?.value ?? null),
      macd: {
        macd:   (macdLine || []).map(m => m?.value ?? null),
        signal: (macdSignal || []).map(s => s?.value ?? null),
        hist:   (macdHistogram || []).map(h => h?.value ?? null),
      },
      // Si en el futuro se añaden bandas de Bollinger:
      // bb: { upper: [], lower: [] }
    };
  }, [ema20, ema50, rsi14, macdLine, macdSignal, macdHistogram]);

  // -------------------------------------------------------
  // 9. CONSTRUCCIÓN DE EVENTOS (RSI, MACD, DIVERGENCIAS, ETC.)
  // -------------------------------------------------------
  const events = useMemo(() => {
    if (!candles1y || !candles1y.length) return [];

    return buildEvents({
      candles: candles1y,
      indicators: indicatorsForEvents,
      divergences,
      cfg: { 
        rsiOversold:  signalConfig.rsiOversold, 
        rsiOverbought: signalConfig.rsiOverbought 
      }
    });
  }, [candles1y, indicatorsForEvents, divergences, signalConfig]);

  // -------------------------------------------------------
  // 10. RENDERIZADO DE ERROR DESTACADO (SI LO HAY)
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // 11. CONFIGURACIÓN E INICIALIZACIÓN DE GRÁFICOS
  // -------------------------------------------------------
  const shouldInitializeCharts =
    Array.isArray(candles1y) && candles1y.length > 0 && !loading;
  
  const { 
    chartContainerRef,  // ref del contenedor del gráfico principal
    rsiContainerRef,    // ref contenedor gráfico RSI
    macdContainerRef,   // ref contenedor gráfico MACD
    chartRef,           // referencia a la instancia del chart (para timeScale, etc.)
    candleSeriesRef     // referencia a la serie de velas
  } = useMarketCharts({
    candles:        shouldInitializeCharts ? candles1y : [],
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
  });

  // -------------------------------------------------------
  // 12. SOPORTE Y RESISTENCIA (CÁLCULO A PARTIR DE VELAS)
  // -------------------------------------------------------
  const { supportLevels, resistanceLevels } = useSupportResistance(candles1y, chartRef);

  // -------------------------------------------------------
  // 13. AUTOLOAD DE VELAS VIA SCROLL EN EL GRÁFICO
  //     - Si el usuario se acerca al "inicio" de la serie, se cargan más velas.
  // -------------------------------------------------------
  const lastSignalRef = useRef(0);        // Marca temporal del último tradeSignal procesado
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const autoLoadTimeoutRef = useRef();

  useEffect(() => {
    // Si no hay chart montado, velas, o ya se está cargando, no se configura el listener
    if (!chartRef || !candles.length || isAutoLoading) return;
    
    console.log('[AutoLoad] Configurando listener de scroll/zoom para carga automática');
    
    // Suscribirse al cambio de rango visible en el eje de tiempo
    const unsubscribe = chartRef.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!candles.length || isAutoLoading) return;
      
      const minIndex = range?.from ?? 0;
      const totalCandles = candles.length;
      
      // Si el usuario está cerca del inicio (minIndex < 5), cargamos más velas hacia atrás
      if (minIndex < 5 && totalCandles >= 50) {
        console.log(`[AutoLoad] Cerca del inicio (${minIndex}), cargando más velas... Total actual: ${totalCandles}`);
        
        setIsAutoLoading(true);
        
        // Evita múltiples timeouts superpuestos
        if (autoLoadTimeoutRef.current) {
          clearTimeout(autoLoadTimeoutRef.current);
        }
        
        autoLoadTimeoutRef.current = setTimeout(() => {
          loadMoreCandles();
          // Pequeño retraso antes de permitir nueva carga
          setTimeout(() => setIsAutoLoading(false), 2000);
        }, 1000);
      }
    });
    
    // Limpieza al desmontar o cambiar dependencias
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

  // -------------------------------------------------------
  // 14. PROCESAMIENTO DE SEÑALES DE TRADING (tradeSignals)
  //     - Actualiza notificaciones, muestra popup y persiste (si auto).
  // -------------------------------------------------------
  useEffect(() => {
    if (!tradeSignals.length) return;

    // Último timestamp conocido (para evitar reprocesar señales viejas)
    const lastKnown = lastSignalRef.current;
    const newestTimestamp = tradeSignals[tradeSignals.length - 1].time;

    // Actualiza la marca de "último procesado"
    lastSignalRef.current = Math.max(lastKnown, newestTimestamp);

    // Filtra solo las señales más recientes
    const freshSignals = tradeSignals.filter((signal) => signal.time > lastKnown);
    if (!freshSignals.length) return;

    // Obtiene identificador y código de estrategia
    const strategyKey = getStrategyKey(selectedStrategy);
    const strategyCode =
      selectedStrategy?.strategy_code ||
      selectedStrategy?.name ||
      'FRONTEND_MACD_RSI';

    // Prepara el batch de señales a guardar y mostrar
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

    // Actualiza bandeja de notificaciones (mantiene solo las últimas 20)
    setNotifications((prev) => {
      const next = [...batch, ...prev];
      return next.slice(0, 20);
    });

    // Muestra popup con la última señal del batch
    const latest = batch[batch.length - 1];
    setPopup({
      open: true,
      message: buildToastMessage(latest, tradeMode),
    });

    // Si el modo es automático, persiste las señales en backend
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

  // -------------------------------------------------------
  // 15. HANDLERS PARA TICKER PERSONALIZADO
  // -------------------------------------------------------
  const handleCustomTickerLoad = useCallback((ticker) => {
    setSymbol(ticker);
    setCustomTicker('');
  }, []);

  const handleCustomTickerChange = useCallback((value) => {
    setCustomTicker(value);
  }, []);

  // -------------------------------------------------------
  // 16. RENDER DEL COMPONENTE
  // -------------------------------------------------------
  return (
    <div className="page-mercado">
      {/* Popup general de notificaciones */}
      <Notification
        message={popup.message}
        open={popup.open}
        onClose={() => setPopup({ open: false, message: '' })}
      />

      {/* Header con selector de símbolo y ticker personalizado */}
      <MarketHeader
        symbol={symbol}
        onSymbolChange={setSymbol}
        customTicker={customTicker}
        onCustomTickerChange={handleCustomTickerChange}
        onLoadCustomTicker={handleCustomTickerLoad}
      />

      {/* Zona superior de controles de mercado */}
      <section className="market-controls">
        {renderError}
        
        {/* Selector de intervalo temporal */}
        <IntervalSelector
          interval={interval}
          onIntervalChange={setInterval}
        />

        {/* Selector de estrategia + panel de configuración de la estrategia */}
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

        {/* Controles de modo de trading (notificar vs auto) */}
        <TradingControls
          tradeMode={tradeMode}
          onTradeModeChange={setTradeMode}
        />
      </section>

      {/* Contenedor principal de gráficos */}
      <section className="market-chart-wrapper">
        {/* Gráfico principal de precio (velas + indicadores de precio) */}
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

        {/* Gráfico RSI (opcional según settings) */}
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

        {/* Gráfico MACD (opcional según settings) */}
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

      {/* Resumen de mercado + niveles de soporte/resistencia */}
      <MarketSummary
        symbol={symbol}
        interval={interval}
        candles={candles}
        supportLevels={supportLevels}
        resistanceLevels={resistanceLevels}
      />

      {/* Tabla de eventos (divergencias, alertas RSI/MACD, etc.) */}
      <EventsTable events={events} symbol={symbol} />

      {/* Bandeja de notificaciones históricas de señales */}
      <NotificationTray
        notifications={notifications}
        tradeMode={tradeMode}
      />
    </div>
  );
};

export default Mercado;
