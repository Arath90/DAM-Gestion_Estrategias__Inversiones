import { INDICATOR_CONFIG, INDICATOR_TOGGLE_TO_CONFIG } from '../constants/indicatorConfig';
import { INDICATOR_TOGGLES } from '../constants/strategyProfiles';

export const MODEL_TYPE = 'DATASET_COMPONENTS';
export const ALL_INDICATOR_KEYS = INDICATOR_TOGGLES.map((item) => item.key);

export const parseLargeJSON = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return { ...value };
  return {};
};

export const parseComponentsArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(value?.components)) return value.components;
  return [];
};

export const deriveIndicatorKeys = (components = []) => {
  const keys = new Set();
  components.forEach((component) => {
    const { kind, params = {} } = component;
    const aliasRaw = (component.alias || component.output_key || '').toLowerCase();
    const alias = aliasRaw.normalize ? aliasRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : aliasRaw;
    if (kind === 'indicator:rsi') keys.add('rsi');
    else if (kind === 'indicator:macd') keys.add('macd');
    else if (kind === 'indicator:bb' || kind === 'indicator:bollinger') {
      keys.add('bollinger');
    }
    else if (kind === 'indicator:ema') {
      const period = Number(params.period);
      if (period === 20) keys.add('ema20');
      if (period === 50) keys.add('ema50');
    } else if (kind === 'indicator:sma') {
      const period = Number(params.period);
      if (period === 200) keys.add('sma200');
    } else if (kind === 'price') {
      const field = (params.field || component.output_key || '').toLowerCase();
      if (field.includes('vol')) keys.add('volume');
    } else if (kind === 'custom') {
      if (alias.includes('senal')) keys.add('signals');
    }
  });
  return Array.from(keys);
};

export const normalizeDatasetKey = (datasetValue) => {
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

export const clampIndicatorSettings = (settings = {}, allowedKeys = ALL_INDICATOR_KEYS) => {
  const next = {};
  const keys = allowedKeys.length ? allowedKeys : ALL_INDICATOR_KEYS;
  keys.forEach((key) => {
    next[key] = !!settings[key];
  });
  return next;
};

export const shallowEqual = (a = {}, b = {}) => {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

export const deriveAllowedIndicatorKeys = (componentsMap, datasetIdRaw) => {
  const datasetId = normalizeDatasetKey(datasetIdRaw);
  if (!datasetId) return ALL_INDICATOR_KEYS;
  const entry = componentsMap[datasetId];
  if (entry?.indicatorKeys?.length) return entry.indicatorKeys;
  return ALL_INDICATOR_KEYS;
};

export const deriveAllowedConfigKeys = (componentsMap, datasetIdRaw) => {
  const toggleKeys = deriveAllowedIndicatorKeys(componentsMap, datasetIdRaw);
  const configKeys = toggleKeys.map((key) => INDICATOR_TOGGLE_TO_CONFIG[key]).filter(Boolean);
  const unique = [...new Set(configKeys)];
  return unique.length ? unique : Object.keys(INDICATOR_CONFIG);
};

export const buildDatasetComponentsMap = (records = []) => {
  const mapped = {};
  records.forEach((record) => {
    const metrics = parseLargeJSON(record.metricsJson || record.metrics_json || record.metrics);
    if (metrics?.model_type !== MODEL_TYPE) return;
    const datasetIdRaw =
      metrics?.dataset_id ||
      metrics?.datasetId ||
      record.dataset_id ||
      record.datasetId;
    if (!datasetIdRaw) return;
    const datasetId = String(datasetIdRaw);
    const components = parseComponentsArray(metrics?.components);
    const metadata = parseLargeJSON(metrics?.metadata);
    mapped[datasetId] = {
      components,
      metadata,
      indicatorKeys: deriveIndicatorKeys(components),
      modelId: record.ID || record.id,
    };
  });
  return mapped;
};
