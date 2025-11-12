import React from 'react';
import { DEFAULT_SYMBOLS } from '../../services/marketData';
import '../../assets/css/components/MarketHeader.css';
import '../../assets/css/components/SharedMarketComponents.css';

/**
 * Header del componente Market con selección de instrumentos
 */
const MarketHeader = ({ 
  symbol, 
  onSymbolChange, 
  customTicker, 
  onCustomTickerChange, 
  onLoadCustomTicker 
}) => {
  const handleSymbolPreset = (event) => {
    onSymbolChange(event.target.value);
    onCustomTickerChange('');
  };

  const handleCustomTickerSubmit = () => {
    if (customTicker.trim()) {
      onLoadCustomTicker(customTicker.trim().toUpperCase());
    }
  };

  const handleCustomTickerKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleCustomTickerSubmit();
    }
  };

  return (
    <header className="market-header">
      <div>
        <h2>Mercado</h2>
        <p>Monitorea precios, indicadores y señales automatizadas.</p>
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
              onChange={(event) => onCustomTickerChange(event.target.value.toUpperCase())}
              onKeyPress={handleCustomTickerKeyPress}
              placeholder="Ej. TSLA"
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCustomTickerSubmit}
              disabled={!customTicker.trim()}
            >
              Cargar
            </button>
          </div>
        </label>
      </div>
    </header>
  );
};

export default MarketHeader;