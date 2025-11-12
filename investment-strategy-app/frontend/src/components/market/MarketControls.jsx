import React from 'react';
import { INTERVALS, TRADE_MODES, INTERVAL_GROUPS } from '../../constants/marketConstants';
import { isValidCustomInterval } from '../../utils/marketUtils';
import '../../assets/css/marketComponents/SharedMarketComponents.css';

/**
 * Componente para los controles principales del mercado:
 * - Selector de símbolo
 * - Selector de intervalo (con soporte para intervalos personalizados)
 * - Selector de modo de trading
 */
const MarketControls = ({
  symbol,
  setSymbol,
  interval,
  setInterval,
  tradeMode,
  setTradeMode,
  symbols,
  customInterval,
  setCustomInterval,
  onApplyCustomInterval,
}) => {
  const handleCustomIntervalSubmit = (e) => {
    e.preventDefault();
    const trimmedInterval = customInterval.trim();
    
    if (!trimmedInterval) {
      alert('Por favor ingresa un intervalo personalizado');
      return;
    }
    
    if (!isValidCustomInterval(trimmedInterval)) {
      alert('Intervalo no válido. Usa formato: número + unidad (min/hour/day/week)\\nEjemplos: 15min, 4hour, 3day, 2week');
      return;
    }
    
    onApplyCustomInterval(trimmedInterval);
  };

  const groupedIntervals = INTERVALS.reduce((acc, interval) => {
    if (!acc[interval.group]) {
      acc[interval.group] = [];
    }
    acc[interval.group].push(interval);
    return acc;
  }, {});

  return (
    <div className="market-controls">
      {/* Selector de Símbolo */}
      <div className="control-group">
        <label htmlFor="symbol-select">Instrumento</label>
        <select
          id="symbol-select"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="form-control"
        >
          {symbols.map((sym) => (
            <option key={sym.value} value={sym.value}>
              {sym.label}
            </option>
          ))}
        </select>
      </div>

      {/* Selector de Intervalo */}
      <div className="control-group">
        <label htmlFor="interval-select">Intervalo</label>
        <select
          id="interval-select"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          className="form-control"
        >
          {Object.entries(groupedIntervals).map(([group, intervals]) => (
            <optgroup 
              key={group} 
              label={INTERVAL_GROUPS[group]?.label || group}
            >
              {intervals.map((int) => (
                <option key={int.value} value={int.value}>
                  {int.fullLabel}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Intervalo Personalizado */}
      <div className="control-group">
        <label htmlFor="custom-interval">Intervalo Personalizado</label>
        <form onSubmit={handleCustomIntervalSubmit} className="custom-interval-form">
          <input
            id="custom-interval"
            type="text"
            value={customInterval}
            onChange={(e) => setCustomInterval(e.target.value)}
            placeholder="ej: 15min, 4hour, 3day, 2week"
            className="form-control"
          />
          <button type="submit" className="btn btn-primary">
            Aplicar
          </button>
        </form>
      </div>

      {/* Modo de Trading */}
      <div className="control-group">
        <label htmlFor="trade-mode">Modo</label>
        <select
          id="trade-mode"
          value={tradeMode}
          onChange={(e) => setTradeMode(e.target.value)}
          className="form-control"
        >
          <option value={TRADE_MODES.notify}>Solo Avisos</option>
          <option value={TRADE_MODES.auto}>Auto Trading</option>
        </select>
      </div>
    </div>
  );
};

export default MarketControls;