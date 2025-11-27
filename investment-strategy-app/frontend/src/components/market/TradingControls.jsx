import React from 'react';
import { TRADE_MODES } from '../../constants/marketConstants';
import '../../assets/css/marketComponents/TradingControls.css';
import '../../assets/css/marketComponents/SharedMarketComponents.css';

/**
 * Controles de configuracion de trading y modo de ejecucion
 */
const TradingControls = ({
  tradeMode,
  onTradeModeChange,
  onSaveStrongSignals,
  savingStrongSignals = false,
  canSaveStrongSignals = false,
  strongSignalHint = '',
}) => {
  return (
    <div className="signal-config">
      <label className="section-label">
        <span className="label-icon">??</span>
        Configuraci?n de ejecuci?n
      </label>
      <div className="trade-mode">
        <span className="mode-label">Modo de Trading:</span>
        <label>
          <input
            type="radio"
            name="trade-mode"
            value={TRADE_MODES.notify}
            checked={tradeMode === TRADE_MODES.notify}
            onChange={(event) => onTradeModeChange(event.target.value)}
          />
          Solo avisos
        </label>
        <label>
          <input
            type="radio"
            name="trade-mode"
            value={TRADE_MODES.auto}
            checked={tradeMode === TRADE_MODES.auto}
            onChange={(event) => onTradeModeChange(event.target.value)}
          />
          Auto trading
        </label>
      </div>
      {typeof onSaveStrongSignals === 'function' && (
        <div className="strong-signals-control">
          <button
            type="button"
            className="btn-secondary strong-signals-btn"
            disabled={!canSaveStrongSignals || savingStrongSignals}
            onClick={onSaveStrongSignals}
          >
            {savingStrongSignals ? 'Guardando strong signals...' : 'Guardar strong signals'}
          </button>
          <small className="strong-signals-hint">
            {strongSignalHint ||
              'Persiste las divergencias m?s fuertes en Cosmos DB para consulta posterior.'}
          </small>
        </div>
      )}
    </div>
  );
};

export default TradingControls;
