import React, { useState, useEffect } from 'react';
import { INTERVALS } from '../../constants/marketConstants';
import { formatCustomInterval, getIntervalLabel, isValidCustomInterval } from '../../utils/marketUtils';
import '../../assets/css/marketComponents/IntervalSelector.css';
import '../../assets/css/marketComponents/SharedMarketComponents.css';

/**
 * Selector de intervalos de tiempo con soporte para intervalos personalizados
 */
const IntervalSelector = ({ interval, onIntervalChange }) => {
  const [showIntervalDropdown, setShowIntervalDropdown] = useState(false);
  const [customIntervalType, setCustomIntervalType] = useState('min');
  const [customIntervalValue, setCustomIntervalValue] = useState('');
  const [customIntervalError, setCustomIntervalError] = useState('');

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showIntervalDropdown && !event.target.closest('.interval-group')) {
        setShowIntervalDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showIntervalDropdown]);

  // Limpiar errores cuando se cierre el dropdown
  useEffect(() => {
    if (!showIntervalDropdown) {
      setCustomIntervalError('');
    }
  }, [showIntervalDropdown]);

  // Popular el formulario personalizado si el intervalo actual es personalizado
  useEffect(() => {
    if (interval && !INTERVALS.some(itv => itv.value === interval)) {
      const match = interval.match(/^(\d+)(min|hour|day|week)$/);
      if (match && !customIntervalValue) {
        setCustomIntervalValue(match[1]);
        setCustomIntervalType(match[2]);
      }
    }
  }, [interval, customIntervalValue]);

  const intervalLabel = getIntervalLabel(interval);
  const isCustomInterval = interval && !INTERVALS.some(itv => itv.value === interval);

  const handleCustomIntervalSubmit = () => {
    const numValue = Number(customIntervalValue);
    if (!customIntervalValue || isNaN(numValue) || numValue < 1 || numValue > 10000) {
      setCustomIntervalError('Ingresa una cantidad válida entre 1 y 10000.');
      return;
    }
    const newInterval = `${numValue}${customIntervalType}`;
    if (!isValidCustomInterval(newInterval)) {
      setCustomIntervalError('Intervalo personalizado inválido.');
      return;
    }
    onIntervalChange(newInterval);
    setShowIntervalDropdown(false);
    console.log(`✅ Intervalo personalizado aplicado: ${newInterval}`);
  };

  const handleCustomValueChange = (value) => {
    setCustomIntervalValue(value);
    
    // Validación más específica por tipo
    const num = Number(value);
    if (!value || isNaN(num) || num < 1) {
      setCustomIntervalError('Ingresa un número mayor a 0.');
    } else if (num > 10000) {
      setCustomIntervalError('El máximo permitido es 10,000.');
    } else if (customIntervalType === 'min' && num > 1440) {
      setCustomIntervalError('Para minutos, el máximo recomendado es 1440 (1 día).');
    } else if (customIntervalType === 'hour' && num > 168) {
      setCustomIntervalError('Para horas, el máximo recomendado es 168 (1 semana).');
    } else {
      setCustomIntervalError('');
    }
  };

  const handleCustomTypeChange = (type) => {
    setCustomIntervalType(type);
    // Limpiar errores al cambiar la unidad
    setCustomIntervalError('');
    // Sugerir un valor por defecto según la unidad
    if (!customIntervalValue) {
      const defaults = { min: '15', hour: '4', day: '1', week: '1' };
      setCustomIntervalValue(defaults[type] || '');
    }
  };

  const renderIntervalGroup = (groupName, groupLabel) => (
    <div className="interval-group" key={groupName}>
      <span className="group-label">{groupLabel}</span>
      <div className="interval-buttons">
        {INTERVALS.filter(itv => itv.group === groupName).map((itv) => (
          <button
            key={itv.value}
            type="button"
            className={interval === itv.value ? 'active' : ''}
            onClick={() => onIntervalChange(itv.value)}
            title={itv.fullLabel}
          >
            {itv.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="intervals-section">
      <label className="section-label">
        <span className="label-icon">⏱️</span>
        Intervalo de Tiempo
      </label>
      <div className="intervals-grid">
        {renderIntervalGroup('largo', 'Largo Plazo')}
        {renderIntervalGroup('medio', 'Mediano Plazo')}
        {renderIntervalGroup('corto', 'Corto Plazo')}
        
        <div className="interval-group">
          <span className="group-label">Personalizado</span>
          <div className="interval-buttons" style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            <button
              type="button"
              className={isCustomInterval ? 'custom-active' : ''}
              onClick={() => {
                setShowIntervalDropdown((prev) => !prev);
                setCustomIntervalError('');
              }}
              title={isCustomInterval
                ? `Intervalo personalizado: ${intervalLabel}` 
                : 'Configurar intervalo personalizado'
              }
            >
              {isCustomInterval
                ? `📅 ${formatCustomInterval(interval)}` 
                : '📅 Personalizado'
              }
            </button>
            {showIntervalDropdown && (
              <div className="custom-interval-dropdown">
                <div className="dropdown-header">
                  <span>⚙️</span>
                  Intervalo personalizado
                </div>
                
                <div className="custom-interval-form">
                  <div className="form-field quantity">
                    <span>Cantidad:</span>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={customIntervalValue}
                      placeholder={customIntervalType === 'min' ? 'ej: 15' : customIntervalType === 'hour' ? 'ej: 4' : customIntervalType === 'day' ? 'ej: 1' : 'ej: 1'}
                      onChange={e => handleCustomValueChange(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-field unit">
                    <span>Unidad:</span>
                    <select 
                      value={customIntervalType} 
                      onChange={e => handleCustomTypeChange(e.target.value)}
                    >
                      <option value="min">Minutos</option>
                      <option value="hour">Horas</option>
                      <option value="day">Días</option>
                      <option value="week">Semanas</option>
                    </select>
                  </div>
                </div>

                {customIntervalError && (
                  <div className="custom-interval-error">
                    <span>⚠️</span>
                    {customIntervalError}
                  </div>
                )}

                <div className="custom-interval-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowIntervalDropdown(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="apply-btn"
                    disabled={!!customIntervalError || !customIntervalValue}
                    onClick={handleCustomIntervalSubmit}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntervalSelector;