import React, { useMemo } from 'react'; // <-- Agregamos useMemo
import IndicatorParamsForm from './IndicatorParamsForm.jsx'; // <-- NUEVO: Importamos el componente
import { INDICATOR_CONFIG } from '../constants/indicatorConfig'; // <-- NUEVO: Importamos la config
import {
  DEFAULT_INDICATOR_SETTINGS,
  DEFAULT_SIGNAL_CONFIG,
  INDICATOR_TOGGLES,
  STRATEGY_SIGNAL_FIELDS,
  describeIndicators,
  hydrateStrategyProfile,
} from '../constants/strategyProfiles';

const StrategyCard = ({
  item,
  isExpanded,
  onToggle,
  onDelete,
  onChangeField,
  onChangeIndicatorSetting,
  onChangeSignalConfig,
  onSubmitEdit,
  editState,
  submittingId,
  FIELD_CONFIG,
  datasetOptions = [],
  datasetsLoading = false,
}) => {
  const indicatorSettings = {
    ...DEFAULT_INDICATOR_SETTINGS,
    ...(editState.indicator_settings || {}),
  };
  const signalConfig = {
    ...DEFAULT_SIGNAL_CONFIG,
    ...(editState.signal_config || {}),
  };

  const currentIndicatorKey = useMemo(() => {
    // Obtenemos todos los IDs de los parámetros guardados.
    const paramIds = Object.keys(editState.indicator_params || {});
    if (paramIds.length === 0) return 'RSI'; // Valor por defecto si no hay parámetros guardados

    // Intentamos determinar el indicador basándonos en los prefijos de los IDs
    for (const key of Object.keys(INDICATOR_CONFIG)) {
      // Buscamos si algún ID de parámetro comienza con la clave del indicador (ej. 'RSI_')
      if (paramIds.some(id => id.startsWith(key + '_'))) {
        return key;
      }
    }
    return 'RSI'; // Volvemos al default si no encontramos una coincidencia
  }, [editState.indicator_params]);

  // Función para actualizar los parámetros del indicador en el estado de edición
  const handleEditIndicatorParamChange = (id, value) => {
    const nextParams = {
      ...(editState.indicator_params || {}),
      [id]: value,
    };
    // Llamamos al handler del padre para actualizar el estado del formulario de edición.
    onChangeField(item.ID, 'indicator_params', nextParams);
  };

  const {
    indicatorSettings: persistedIndicators,
    signalConfig: persistedSignalConfig,
  } = hydrateStrategyProfile(item);
  const indicatorSummary = describeIndicators(persistedIndicators);

  const datasetRaw = item.dataset_id;
  const datasetValue =
    typeof datasetRaw === 'string'
      ? datasetRaw
      : datasetRaw?.ID || datasetRaw?._id || datasetRaw?.id || '';
  const datasetOptionLabel = datasetOptions.find(
    (opt) => opt.value && opt.value === datasetValue,
  )?.label;
  const datasetLabel =
    datasetOptionLabel ||
    (typeof datasetRaw === 'object' && datasetRaw ? datasetRaw.name : '') ||
    datasetValue ||
    '-';

  return (
    <article className={`strategy-row${isExpanded ? ' expanded' : ''}`}>
      <header className="strategy-head">
        <button type="button" className="strategy-toggle" onClick={() => onToggle(item.ID)}>
          <span className="title">{item.name || 'Sin nombre'}</span>
          <span className="meta">
            {item.type || 'N/D'} &middot; {item.status || 'Sin estado'} &middot;{' '}
            {item.owner || 'Sin dueño'}
          </span>
          <span className="chevron" aria-hidden="true">{isExpanded ? '^' : 'v'}</span>
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={() => onDelete(item.ID)}
          disabled={submittingId === item.ID}
        >
          {submittingId === item.ID ? 'Eliminando...' : 'Eliminar'}
        </button>
      </header>

      {isExpanded && (
        <div className="strategy-dropdown">
          <div className="strategy-details">
            {/* ... (Contenido de strategy-details: ID, Capital, Frecuencia, etc.) ... */}
            <div>
              <strong>ID</strong>
              <span>{item.ID}</span>
            </div>
            <div>
              <strong>Capital asignado</strong>
              <span>{item.capital_allocated != null ? item.capital_allocated : '-'}</span>
            </div>
            <div>
              <strong>Frecuencia</strong>
              <span>{item.frequency || '-'}</span>
            </div>
            <div>
              <strong>Dataset</strong>
              <span>{datasetLabel}</span>
            </div>
            <div>
              <strong>Indicadores</strong>
              <span>{indicatorSummary || '-'}</span>
            </div>
            <div>
              <strong>Señales</strong>
              <span>
                RSI&nbsp;
                {persistedSignalConfig.rsiOversold}/{persistedSignalConfig.rsiOverbought}
                &nbsp;· MACD ≥ {persistedSignalConfig.macdHistogramThreshold}
              </span>
            </div>
            <div>
              <strong>Etiquetas</strong>
              <span>{Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '-')}</span>
            </div>
            <div>
              <strong>Creada</strong>
              <span>{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</span>
            </div>
            <div>
              <strong>Actualizada</strong>
              <span>{item.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}</span>
            </div>
          </div>

          <form className="estrategia-form" onSubmit={(e) => onSubmitEdit(e, item.ID)}>
            <h4>Editar estrategia</h4>

            {/* 1. CAMPOS DE TEXTO/SELECT NORMALES (FIELD_CONFIG.map) */}
            <div className="form-grid">
              {FIELD_CONFIG.map(({ name, label, type, placeholder, step, as, options }) => {
                const isDatasetField = name === 'dataset_id';
                const selectOptions = isDatasetField ? datasetOptions : options;
                return (
                  <label key={name} className="form-field">
                    <span>{label}</span>
                    {as === 'textarea' ? (
                      <textarea
                        value={editState[name] ?? ''}
                        placeholder={placeholder}
                        onChange={(ev) => onChangeField(item.ID, name, ev.target.value)}
                      />
                    ) : as === 'select' ? (
                      <>
                        <select
                          value={editState[name] ?? ''}
                          onChange={(ev) => onChangeField(item.ID, name, ev.target.value)}
                          disabled={isDatasetField && datasetsLoading}
                        >
                          {(selectOptions || []).map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {isDatasetField && !datasetsLoading && selectOptions.length <= 1 && (
                          <small className="form-hint">No hay datasets disponibles. Registra uno en la sección Datasets.</small>
                        )}
                      </>
                    ) : (
                      <input
                        type={type}
                        value={editState[name] ?? ''}
                        {...(['text', 'number', 'email', 'password', 'search', 'tel', 'url'].includes(type) && placeholder
                          ? { placeholder }
                          : {})}
                        step={step}
                        onChange={(ev) => onChangeField(item.ID, name, ev.target.value)}
                      />
                    )}
                  </label>
                );
              })}
            </div>

            {/* 2. FORMULARIO DINÁMICO DE INDICADOR */}
            <IndicatorParamsForm
              indicatorKey={currentIndicatorKey}
              params={editState.indicator_params || {}}
              onParamChange={handleEditIndicatorParamChange}
              isEditing={true}
            />

            {/* 3. INDICADORES VINCULADOS */}
            <div className="strategy-config-block">
              <h5>Indicadores vinculados</h5>
              <div className="indicator-toggle-grid">
                {INDICATOR_TOGGLES.map(({ key, label, icon }) => (
                  <label key={key} className="indicator-toggle">
                    <input
                      type="checkbox"
                      checked={!!indicatorSettings[key]}
                      onChange={(ev) =>
                        onChangeIndicatorSetting(item.ID, key, ev.target.checked)
                      }
                    />
                    <span className="toggle-content">
                      <span className="toggle-icon">{icon}</span>
                      <span className="toggle-label">{label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 4. CONFIGURACIÓN DE SEÑALES */}
            <div className="strategy-config-block">
              <h5>Configuración de señales</h5>
              <div className="config-grid">
                {STRATEGY_SIGNAL_FIELDS.map(({ key, label, step, min }) => (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      type="number"
                      value={signalConfig[key] ?? ''}
                      step={step ?? 'any'}
                      min={min}
                      onChange={(ev) =>
                        onChangeSignalConfig(item.ID, key, ev.target.value)
                      }
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* 5. BOTÓN DE SUBMIT */}
            <button type="submit" className="primary" disabled={submittingId === item.ID}>
              {submittingId === item.ID ? 'Guardando...' : 'Actualizar'}
            </button>
          </form>
        </div>
      )}
    </article >
  );
};

export default StrategyCard;
