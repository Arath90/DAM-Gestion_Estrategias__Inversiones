// src/components/market/MarketConfigPanel.jsx
// ---------------------------------------------------------
// Panel de configuración que agrupa:
// - Selector de intervalo temporal
// - Selector de estrategia con configuración
// - Controles de modo de trading
// ---------------------------------------------------------

import React from 'react';
import IntervalSelector from './IntervalSelector';
import StrategySelector from './StrategySelector';
import TradingControls from './TradingControls';

/**
 * Panel de configuración de mercado
 */
const MarketConfigPanel = ({
  interval,
  onIntervalChange,
  strategies,
  selectedStrategyId,
  onStrategyChange,
  strategiesLoading,
  strategiesError,
  onRefreshStrategies,
  settings,
  signalConfig,
  tradeMode,
  onTradeModeChange,
  error,
  onSaveStrongSignals,
  savingStrongSignals,
  canSaveStrongSignals,
  strongSignalHint,
}) => {
  return (
    <section className="market-controls">
      {error && (
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
      )}
      
      <IntervalSelector
        interval={interval}
        onIntervalChange={onIntervalChange}
      />

      <StrategySelector
        strategies={strategies}
        selectedStrategyId={selectedStrategyId}
        onStrategyChange={onStrategyChange}
        strategiesLoading={strategiesLoading}
        strategiesError={strategiesError}
        onRefreshStrategies={onRefreshStrategies}
        settings={settings}
        signalConfig={signalConfig}
      />

      <div className="controls-divider"></div>

      <TradingControls
        tradeMode={tradeMode}
        onTradeModeChange={onTradeModeChange}
        onSaveStrongSignals={onSaveStrongSignals}
        savingStrongSignals={savingStrongSignals}
        canSaveStrongSignals={canSaveStrongSignals}
        strongSignalHint={strongSignalHint}
      />
    </section>
  );
};

export default MarketConfigPanel;
