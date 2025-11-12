import React from 'react';
import { INDICATOR_TOGGLES } from '../../constants/strategyProfiles';
import '../../assets/css/components/IndicatorSettings.css';
import '../../assets/css/components/SharedMarketComponents.css';

/**
 * Componente para configuración de indicadores técnicos
 */
const IndicatorSettings = ({ settings, onSettingChange, signalConfig, onSignalConfigChange }) => {
  return (
    <div className="indicator-settings">
      <h3>📊 Indicadores Técnicos</h3>
      
      {/* Toggles de Indicadores */}
      <div className="indicators-grid">
        {Object.entries(INDICATOR_TOGGLES).map(([key, config]) => (
          <div key={key} className="indicator-toggle">
            <label>
              <input
                type="checkbox"
                checked={settings[key] || false}
                onChange={(e) => onSettingChange(key, e.target.checked)}
              />
              <span className="toggle-label">
                {config.icon} {config.label}
              </span>
            </label>
            {config.description && (
              <small className="toggle-description">{config.description}</small>
            )}
          </div>
        ))}
      </div>

      {/* Configuración de Señales */}
      <div className="signals-config">
        <h4>🚦 Configuración de Señales</h4>
        
        <div className="config-row">
          <label htmlFor="ema-crossing">Cruce de EMAs</label>
          <input
            id="ema-crossing"
            type="checkbox"
            checked={signalConfig?.emaCrossing || false}
            onChange={(e) => onSignalConfigChange('emaCrossing', e.target.checked)}
          />
        </div>
        
        <div className="config-row">
          <label htmlFor="rsi-levels">Niveles RSI</label>
          <input
            id="rsi-levels"
            type="checkbox"
            checked={signalConfig?.rsiLevels || false}
            onChange={(e) => onSignalConfigChange('rsiLevels', e.target.checked)}
          />
        </div>
        
        <div className="config-row">
          <label htmlFor="macd-signals">Señales MACD</label>
          <input
            id="macd-signals"
            type="checkbox"
            checked={signalConfig?.macdSignals || false}
            onChange={(e) => onSignalConfigChange('macdSignals', e.target.checked)}
          />
        </div>
        
        <div className="config-row">
          <label htmlFor="volume-confirmation">Confirmación por Volumen</label>
          <input
            id="volume-confirmation"
            type="checkbox"
            checked={signalConfig?.volumeConfirmation || false}
            onChange={(e) => onSignalConfigChange('volumeConfirmation', e.target.checked)}
          />
        </div>
      </div>
    </div>
  );
};

export default IndicatorSettings;