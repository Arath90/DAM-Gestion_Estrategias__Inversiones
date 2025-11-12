import React from 'react';
import { TRADE_MODES } from '../../constants/marketConstants';
import '../../assets/css/marketComponents/TradingControls.css';
import '../../assets/css/marketComponents/SharedMarketComponents.css';

/**
 * Controles de configuración de trading y modo de ejecución
 */
const TradingControls = ({ tradeMode, onTradeModeChange }) => {
  return (
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
    </div>
  );
};

export default TradingControls;