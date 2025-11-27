import React, { useMemo } from 'react';
import IndicatorParamsForm from './IndicatorParamsForm.jsx';
import {
  INDICATOR_CONFIG,
  INDICATOR_TOGGLE_TO_CONFIG,
  buildIndicatorDefaultParams,
} from '../constants/indicatorConfig';
import {
  DEFAULT_INDICATOR_SETTINGS,
  DEFAULT_SIGNAL_CONFIG,
  INDICATOR_TOGGLES,
  STRATEGY_SIGNAL_FIELDS,
  describeIndicators,
  hydrateStrategyProfile,
} from '../constants/strategyProfiles';

const ALL_INDICATOR_TOGGLE_KEYS = INDICATOR_TOGGLES.map(({ key }) => key);
const DEFAULT_CONFIG_KEYS = Object.keys(INDICATOR_CONFIG);
const DEFAULT_INDICATOR_PARAM_VALUES = buildIndicatorDefaultParams();

const normalizeDatasetKey = (datasetValue) => {
  if (!datasetValue) return '';
  if (typeof datasetValue === 'object') {
    return String(
      datasetValue.ID ||
        datasetValue.id ||
        datasetValue._id ||
        datasetValue.value ||
        datasetValue.name ||
        '',
    );
  }
  return String(datasetValue);
};

const deriveAllowedIndicatorKeys = (componentsMap = {}, datasetIdRaw) => {
  const datasetId = normalizeDatasetKey(datasetIdRaw);
  if (!datasetId) return ALL_INDICATOR_TOGGLE_KEYS;
  const entry = componentsMap[datasetId];
  if (entry?.indicatorKeys?.length) return entry.indicatorKeys;
  return ALL_INDICATOR_TOGGLE_KEYS;
};

const deriveAllowedConfigKeys = (componentsMap = {}, datasetIdRaw) => {
  const toggleKeys = deriveAllowedIndicatorKeys(componentsMap, datasetIdRaw);
  const configKeys = toggleKeys.map((key) => INDICATOR_TOGGLE_TO_CONFIG[key]).filter(Boolean);
  const unique = [...new Set(configKeys)];
  return unique.length ? unique : Object.keys(INDICATOR_CONFIG);
};

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
  datasetComponentsMap = {},
  datasetKeyOverride,
  allowedIndicatorKeys,
  allowedIndicatorConfigKeys,
}) => {
  const indicatorSettings = {
    ...DEFAULT_INDICATOR_SETTINGS,
    ...(editState.indicator_settings || {}),
  };
  const signalConfig = {
    ...DEFAULT_SIGNAL_CONFIG,
    ...(editState.signal_config || {}),
  };

  const mergedIndicatorParams = useMemo(
    () => ({
      ...DEFAULT_INDICATOR_PARAM_VALUES,
      ...(editState.indicator_params || {}),
    }),
    [editState.indicator_params],
  );

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

  const derivedToggleKeys = deriveAllowedIndicatorKeys(
    datasetComponentsMap,
    datasetKeyOverride || editState.dataset_id || item.dataset_id,
  );
  const effectiveToggleKeys = (allowedIndicatorKeys && allowedIndicatorKeys.length
    ? allowedIndicatorKeys
    : derivedToggleKeys) || ALL_INDICATOR_TOGGLE_KEYS;
  const filteredToggleList = INDICATOR_TOGGLES.filter(({ key }) =>
    effectiveToggleKeys.includes(key),
  );
  const indicatorToggleList = filteredToggleList.length ? filteredToggleList : INDICATOR_TOGGLES;

  const derivedConfigKeys = deriveAllowedConfigKeys(
    datasetComponentsMap,
    datasetKeyOverride || editState.dataset_id || item.dataset_id,
  );
  const effectiveConfigKeys = (allowedIndicatorConfigKeys && allowedIndicatorConfigKeys.length
    ? allowedIndicatorConfigKeys
    : derivedConfigKeys) || DEFAULT_CONFIG_KEYS;

  const activeConfigKeys = useMemo(() => {
    const settings = editState.indicator_settings || {};
    const activeToggles = Object.entries(settings)
      .filter(([, checked]) => !!checked)
      .map(([key]) => INDICATOR_TOGGLE_TO_CONFIG[key])
      .filter(Boolean);
    const uniqueKeys = [...new Set(activeToggles)];
    if (!effectiveConfigKeys.length) return uniqueKeys;
    return uniqueKeys.filter((key) => effectiveConfigKeys.includes(key));
  }, [editState.indicator_settings, effectiveConfigKeys]);

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
            <div className="strategy-visual-overview">
            <h4>Vista general de la estrategia</h4>
            <p style={{ color: 'var(--project-color2)' }}>
              Esta vista muestra de forma resumida todos los elementos aplicados en la estrategia actual:
              indicadores, señales activas y líneas clave.
            </p>

            <div className="overview-grid">
              <div className="overview-item">
                <h5>Indicadores activos</h5>
                <ul>
                  {Object.entries(persistedIndicators)
                    .filter(([_, v]) => v)
                    .map(([k]) => (
                      <li key={k}>{k.toUpperCase()}</li>
                    ))}
                </ul>
              </div>
              <div className="overview-item">
                <h5>Configuración de señales</h5>
                <ul>
                  <li>RSI: {persistedSignalConfig.rsiOversold} / {persistedSignalConfig.rsiOverbought}</li>
                  <li>MACD Histograma ≥ {persistedSignalConfig.macdHistogramThreshold}</li>
                </ul>
              </div>
              <div className="overview-item">
                <h5>Estado actual</h5>
                <p><strong>{item.status || 'Sin estado'}</strong></p>
              </div>
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
            {activeConfigKeys.length > 0 && (
              <div className="strategy-config-block">
                <h5>Parámetros de indicadores seleccionados</h5>
                {activeConfigKeys.map((configKey) => (
                  <IndicatorParamsForm
                    key={configKey}
                    indicatorKey={configKey}
                    params={mergedIndicatorParams}
                    onParamChange={handleEditIndicatorParamChange}
                    isEditing={true}
                    withContainer={false}
                  />
                ))}
              </div>
            )}

            {/* 3. INDICADORES VINCULADOS */}
            <div className="strategy-config-block">
              <h5>Indicadores vinculados</h5>
              <div className="indicator-toggle-grid">
                {indicatorToggleList.map(({ key, label, icon }) => (
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

            

            {/* 4. BOTÓN DE SUBMIT */}
            <button type="submit" className="primary" disabled={submittingId === item.ID}>
              {submittingId === item.ID ? 'Guardando...' : 'Actualizar'}
            </button>
          </form>
        </div>
      )}
    </article >
  );
};

export default React.memo(StrategyCard);
