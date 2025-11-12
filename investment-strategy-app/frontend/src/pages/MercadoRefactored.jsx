import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SYMBOLS } from '../services/marketData';
import { persistTradeSignals } from '../services/tradingSignals';
import { useMarketData } from '../hooks/useMarketData';
import { useMarketCharts } from '../hooks/useMarketCharts';
import { useSupportResistance } from '../hooks/useSupportResistance';
import { useAutoLoad } from '../hooks/useAutoLoad';
import api from '../config/apiClient';

// Componentes
import MarketControls from '../components/market/MarketControls';
import IndicatorSettings from '../components/market/IndicatorSettings';
import TradeSignals from '../components/market/TradeSignals';

// Constants y utilities
import { 
  DEFAULT_MARKET_STATE, 
  TRADE_MODES 
} from '../constants/marketConstants';
import { 
  buildToastMessage, 
  getLimitForInterval, 
  getSecondsPerCandle,
  isValidCustomInterval 
} from '../utils/marketUtils';
import {
  DEFAULT_INDICATOR_SETTINGS,
  DEFAULT_SIGNAL_CONFIG,
  hydrateStrategyProfile,
} from '../constants/strategyProfiles';

// Styles
import '../assets/css/Mercado.css';
import '../assets/globalAssets.css';

/**
 * Componente principal de Mercado refactorizado
 * 
 * Responsabilidades:
 * - Orquestar el flujo de datos del mercado
 * - Gestionar estado global del componente
 * - Coordinar subcomponentes especializados
 */
const Mercado = () => {
  // Estados principales
  const [symbol, setSymbol] = useState(DEFAULT_MARKET_STATE.symbol);
  const [interval, setInterval] = useState(DEFAULT_MARKET_STATE.interval);
  const [tradeMode, setTradeMode] = useState(DEFAULT_MARKET_STATE.tradeMode);
  const [customInterval, setCustomInterval] = useState('');
  const [settings, setSettings] = useState(DEFAULT_MARKET_STATE.settings);
  const [signalConfig, setSignalConfig] = useState(DEFAULT_SIGNAL_CONFIG);

  // Referencias
  const lastSignalRef = useRef(0);
  const [range, setRange] = useState({
    from: Date.now() / 1000 - 365 * 24 * 60 * 60,
    to: Date.now() / 1000,
  });

  // Cálculo dinámico del límite de velas
  const limit = useMemo(() => {
    const calculatedLimit = getLimitForInterval(interval);
    console.log(`[Mercado] Intervalo: ${interval}, Límite de velas: ${calculatedLimit}`);
    
    // Detectar si es un intervalo personalizado
    const isCustomInterval = interval.match(/^(\\d+)(min|hour|day|week)$/);
    if (isCustomInterval) {
      console.log(`[Mercado] ✅ Intervalo personalizado detectado: ${interval}`);
    }
    
    return calculatedLimit;
  }, [interval]);

  // 1. Hook de datos del mercado
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

  // Filtrar las velas para mostrar solo el último año hasta la fecha actual
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 365 * 24 * 60 * 60;
  const candles1y = useMemo(() => {
    return candles.filter(c => c.time >= oneYearAgo && c.time <= now);
  }, [candles, now]);

  // 2. Hook de gráficos (solo se inicializa cuando hay datos válidos)
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

  // 3. Hook de soporte y resistencia
  const { supportLevels, resistanceLevels } = useSupportResistance(candles1y, chartRef);

  // 4. Función para cargar más velas
  const loadMoreCandles = useCallback(() => {
    setRange((prev) => ({
      from: prev.from - limit * getSecondsPerCandle(interval),
      to: prev.to,
    }));
  }, [limit, interval]);

  // 5. Hook de auto-carga
  const { isAutoLoading } = useAutoLoad(chartRef, candles, loadMoreCandles);

  // Handlers
  const handleSettingChange = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSignalConfigChange = useCallback((key, value) => {
    setSignalConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleApplyCustomInterval = useCallback((newInterval) => {
    setInterval(newInterval);
    setCustomInterval('');
    console.log(`✅ Intervalo personalizado aplicado: ${newInterval}`);
  }, []);

  const handlePersistSignals = useCallback(async (freshSignals) => {
    try {
      await persistTradeSignals(freshSignals, {
        mode: tradeMode,
        symbol,
        interval,
        strategy: 'default',
      });
      console.log('✅ Señales persistidas correctamente');
    } catch (err) {
      console.error('❌ Error persistiendo señales:', err.message);
    }
  }, [tradeMode, symbol, interval]);

  // Render del error si existe
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

  return (
    <div className="mercado-container">
      <header className="mercado-header">
        <h1>📈 Análisis de Mercado</h1>
        <p>Monitoreo en tiempo real y señales de trading</p>
      </header>

      {/* Controles principales */}
      <section className="controls-section">
        <MarketControls
          symbol={symbol}
          setSymbol={setSymbol}
          interval={interval}
          setInterval={setInterval}
          tradeMode={tradeMode}
          setTradeMode={setTradeMode}
          symbols={DEFAULT_SYMBOLS}
          customInterval={customInterval}
          setCustomInterval={setCustomInterval}
          onApplyCustomInterval={handleApplyCustomInterval}
        />
      </section>

      {/* Configuración de indicadores */}
      <section className="settings-section">
        <IndicatorSettings
          settings={settings}
          onSettingChange={handleSettingChange}
          signalConfig={signalConfig}
          onSignalConfigChange={handleSignalConfigChange}
        />
      </section>

      {/* Área de gráficos */}
      <main className="charts-section">
        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Cargando datos del mercado...</p>
          </div>
        )}

        {renderError}

        {/* Gráfico principal */}
        <div className="chart-container">
          <div ref={chartContainerRef} className="main-chart"></div>
        </div>

        {/* Paneles de indicadores */}
        <div className="indicator-panels">
          {settings.rsi && (
            <div className="panel-container">
              <h4>RSI (14)</h4>
              <div ref={rsiContainerRef} className="rsi-chart"></div>
            </div>
          )}

          {settings.macd && (
            <div className="panel-container">
              <h4>MACD</h4>
              <div ref={macdContainerRef} className="macd-chart"></div>
            </div>
          )}
        </div>

        {/* Información de estado */}
        <div className="status-info">
          <div className="status-item">
            <span>📊 Símbolo:</span>
            <strong>{symbol}</strong>
          </div>
          <div className="status-item">
            <span>⏰ Intervalo:</span>
            <strong>{interval}</strong>
          </div>
          <div className="status-item">
            <span>📈 Velas:</span>
            <strong>{candles1y.length}</strong>
          </div>
          <div className="status-item">
            <span>🎯 Modo:</span>
            <strong>{tradeMode === TRADE_MODES.auto ? 'Auto Trading' : 'Solo Avisos'}</strong>
          </div>
          {supportLevels.length > 0 && (
            <div className="status-item">
              <span>🟢 Soportes:</span>
              <strong>{supportLevels.length}</strong>
            </div>
          )}
          {resistanceLevels.length > 0 && (
            <div className="status-item">
              <span>🔴 Resistencias:</span>
              <strong>{resistanceLevels.length}</strong>
            </div>
          )}
          {isAutoLoading && (
            <div className="status-item loading">
              <span>⏳ Cargando más datos...</span>
            </div>
          )}
        </div>
      </main>

      {/* Componente de señales de trading */}
      <TradeSignals
        tradeSignals={tradeSignals}
        tradeMode={tradeMode}
        onPersistSignals={handlePersistSignals}
        lastSignalRef={lastSignalRef}
      />
    </div>
  );
};

export default Mercado;