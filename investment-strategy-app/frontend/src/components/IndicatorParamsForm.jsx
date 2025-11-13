import React, { useMemo } from 'react';
import { INDICATOR_CONFIG } from '../constants/indicatorConfig'; 


const IndicatorParamsForm = ({
  indicatorKey,
  params,
  onParamChange,
  isEditing = false,
  onIndicatorChange = () => {},
  allowedIndicators = Object.keys(INDICATOR_CONFIG),
  withContainer = true,
}) => {
  const options = useMemo(() => {
    const source = Array.isArray(allowedIndicators) && allowedIndicators.length
      ? allowedIndicators
      : Object.keys(INDICATOR_CONFIG);
    const unique = [...new Set(source)].filter((key) => INDICATOR_CONFIG[key]);
    return unique.length ? unique : Object.keys(INDICATOR_CONFIG);
  }, [allowedIndicators]);

  const safeIndicatorKey = options.includes(indicatorKey)
    ? indicatorKey
    : options[0] || indicatorKey;

  const currentIndicatorConfig = useMemo(
    () => INDICATOR_CONFIG[safeIndicatorKey] || { name: 'Desconocido', properties: [] },
    [safeIndicatorKey],
  );

  const content = (
    <>
      {!isEditing && (
        <div className="estrategias-selector-container">
          <label htmlFor="indicador-create" className="selector-label">Indicador a configurar:</label>
          <select
            id="indicador-create"
            value={safeIndicatorKey}
            onChange={(e) => onIndicatorChange(e.target.value)}
            className="selector-indicador"
          >
            {options.map((key) => (
              <option key={key} value={key}>{INDICATOR_CONFIG[key].name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="indicador-properties-form">
        <h5>Parámetros de {currentIndicatorConfig.name}</h5>
        <div className="form-grid indicator-params-grid">
          {currentIndicatorConfig.properties.map((prop) => (
            <label key={prop.id} className="form-field">
              <span style={{ color: 'var(--accent-color1)' }}>
                {prop.label} {prop.required ? '*' : ''}
              </span>
              <input
                type={prop.type || 'text'}
                value={params[prop.id] ?? ''}
                min={prop.min}
                max={prop.max}
                step={prop.step || '1'}
                placeholder={prop.placeholder}
                onChange={(e) => onParamChange(prop.id, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>
    </>
  );

  if (!withContainer) return content;

  return <div className="strategy-config-block">{content}</div>;
};

export default IndicatorParamsForm;
