import React from 'react';
import { getStrategyKey } from '../../utils/marketUtils';
import { INDICATOR_TOGGLES } from '../../constants/strategyProfiles';
import '../../assets/css/marketComponents/StrategySelector.css';
import '../../assets/css/marketComponents/SharedMarketComponents.css';

/**
 * Selector de estrategias con visualización de indicadores activos
 */
const StrategySelector = ({
  strategies,
  selectedStrategyId,
  onStrategyChange,
  strategiesLoading,
  strategiesError,
  onRefreshStrategies,
  settings,
  signalConfig
}) => {
  const indicatorBadges = INDICATOR_TOGGLES.filter(({ key }) => settings[key]);

  return (
    <div className="strategy-section">
      <label className="section-label">
        <span className="label-icon">🧠</span>
        Estrategia de trading
      </label>
      <div className="strategy-selector">
        <select
          value={selectedStrategyId}
          onChange={(event) => onStrategyChange(event.target.value)}
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
          onClick={onRefreshStrategies}
          disabled={strategiesLoading}
        >
          {strategiesLoading ? 'Actualizando...' : 'Refrescar'}
        </button>
      </div>
      {strategiesError && <p className="strategy-status error">{strategiesError}</p>}
      
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
    </div>
  );
};

export default StrategySelector;