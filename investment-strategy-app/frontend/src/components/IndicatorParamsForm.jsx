import React, { useMemo } from 'react';
import { INDICATOR_CONFIG } from '../constants/indicatorConfig'; 


const IndicatorParamsForm = ({ 
    indicatorKey, 
    params, 
    onParamChange, 
    isEditing = false,
    onIndicatorChange 
}) => {
    
    const currentIndicatorConfig = useMemo(() => 
        INDICATOR_CONFIG[indicatorKey] || { name: 'Desconocido', properties: [] }, 
        [indicatorKey]
    );

    return (
        <div className="strategy-config-block">
            {!isEditing && (
                <div className="estrategias-selector-container">
                    <label htmlFor="indicador-create" className="selector-label">Indicador a configurar:</label>
                    <select
                        id="indicador-create"
                        value={indicatorKey}
                        onChange={(e) => onIndicatorChange(e.target.value)} 
                        className="selector-indicador"
                    >
                        {Object.keys(INDICATOR_CONFIG).map(key => (
                            <option key={key} value={key}>{INDICATOR_CONFIG[key].name}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="indicador-properties-form">
                <h5>Parámetros de {currentIndicatorConfig.name}</h5>
                <div className="form-grid indicator-params-grid">
                    {currentIndicatorConfig.properties.map(prop => (
                        <label key={prop.id} className="form-field">
                            <span style={{ color: 'var(--accent-color1)' }}>{prop.label} {prop.required ? '*' : ''}</span>
                            <input
                                type={prop.type || 'text'}
                                value={params[prop.id] || ''}
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
        </div>
    );
};

export default IndicatorParamsForm;