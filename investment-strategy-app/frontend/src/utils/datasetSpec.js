const slugify = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const randomId = () =>
  `cmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const SPEC_META_FIELDS = [
  { name: 'symbol', label: 'Símbolo', placeholder: 'AAPL' },
  { name: 'timeframe', label: 'Timeframe', placeholder: '1D / 1H' },
  { name: 'target', label: 'Variable objetivo', placeholder: 'close' },
  { name: 'notes', label: 'Notas', as: 'textarea', placeholder: 'Observaciones o contexto adicional' },
];

export const DEFAULT_SPEC_META = SPEC_META_FIELDS.reduce((acc, { name }) => {
  acc[name] = '';
  return acc;
}, {});

export const COMPONENT_TEMPLATES = {
  price: {
    label: 'Campo base (OHLCV)',
    params: { field: 'close' },
  },
  'indicator:rsi': {
    label: 'RSI',
    params: { period: 14, source: 'close' },
  },
  'indicator:ema': {
    label: 'EMA',
    params: { period: 20, source: 'close' },
  },
  'indicator:sma': {
    label: 'SMA',
    params: { period: 50, source: 'close' },
  },
  'indicator:macd': {
    label: 'MACD',
    params: { fast: 12, slow: 26, signal: 9, source: 'close' },
  },
    'indicator:bb': {
    label: 'Bandas de bollinger',
    params: { period: 20, source: 'close', multiplier: 2 },
  },
  custom: {
    label: 'Custom / Fórmula',
    params: { expression: '', source: 'close' },
  },
};

export const COMPONENT_OPTIONS = [
  { value: 'price', label: COMPONENT_TEMPLATES.price.label },
  { value: 'indicator:rsi', label: COMPONENT_TEMPLATES['indicator:rsi'].label },
  { value: 'indicator:ema', label: COMPONENT_TEMPLATES['indicator:ema'].label },
  { value: 'indicator:sma', label: COMPONENT_TEMPLATES['indicator:sma'].label },
  { value: 'indicator:macd', label: COMPONENT_TEMPLATES['indicator:macd'].label },
  { value: 'indicator:bb', label: COMPONENT_TEMPLATES['indicator:bb'].label },
  { value: 'custom', label: COMPONENT_TEMPLATES.custom.label },
];

export const createComponentTemplate = (kind = 'price', overrides = {}) => {
  const template = COMPONENT_TEMPLATES[kind] || COMPONENT_TEMPLATES.price;
  return {
    id: overrides.id || randomId(),
    alias: overrides.alias ?? template.label,
    kind,
    include: overrides.include !== undefined ? overrides.include : true,
    output_key: overrides.output_key ?? overrides.params?.output_key ?? '',
    params: {
      ...template.params,
      ...(overrides.params || {}),
    },
    notes: overrides.notes || '',
  };
};

export const normalizeComponent = (component) => {
  if (!component) return createComponentTemplate('price');
  const template = COMPONENT_TEMPLATES[component.kind] || COMPONENT_TEMPLATES.price;
  return {
    id: component.id || randomId(),
    alias: component.alias ?? template.label,
    kind: component.kind || 'price',
    include: component.include !== false,
    output_key: component.output_key ?? component.params?.output_key ?? '',
    params: {
      ...template.params,
      ...(component.params || {}),
    },
    notes: component.notes || '',
  };
};

export const normalizeComponentList = (list = []) =>
  list.map((component) => normalizeComponent(component));

const parseSpecObject = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return { ...value };
  return {};
};

const deriveComponentFromFeature = (feature) => {
  if (!feature && feature !== 0) return null;
  const raw = String(feature).trim();
  if (!raw.length) return null;
  const lower = raw.toLowerCase();

  const emaMatch = lower.match(/^ema[_-]?(\d+)/i);
  if (emaMatch) {
    const period = Number(emaMatch[1]);
    return createComponentTemplate('indicator:ema', {
      alias: `EMA ${period}`,
      output_key: raw,
      params: { period },
    });
  }

  const smaMatch = lower.match(/^sma[_-]?(\d+)/i);
  if (smaMatch) {
    const period = Number(smaMatch[1]);
    return createComponentTemplate('indicator:sma', {
      alias: `SMA ${period}`,
      output_key: raw,
      params: { period },
    });
  }

  const rsiMatch = lower.match(/^rsi[_-]?(\d+)/i);
  if (rsiMatch) {
    const period = Number(rsiMatch[1]);
    return createComponentTemplate('indicator:rsi', {
      alias: `RSI ${period}`,
      output_key: raw,
      params: { period },
    });
  }

  const macdMatch = lower.match(
    /^macd(?:[_-](\d+))?(?:[_-](\d+))?(?:[_-](\d+))?/i,
  );
  if (macdMatch) {
    const fast = Number(macdMatch[1]) || 12;
    const slow = Number(macdMatch[2]) || 26;
    const signal = Number(macdMatch[3]) || 9;
    return createComponentTemplate('indicator:macd', {
      alias: `MACD ${fast}/${slow}/${signal}`,
      output_key: raw,
      params: { fast, slow, signal },
    });
  }

  const bbMatch = lower.match(/^bb[_-]?(\d+)?(?:[_-](\d+))?/i);
  if (bbMatch) {
    const period = Number(bbMatch[1]) || 20;
    const multiplier = Number(bbMatch[2]) || 2;
    return createComponentTemplate('indicator:bb', {
      alias: `BB ${period}/${multiplier}`,
      output_key: raw,
      params: { period, multiplier },
    });
  }

  if (['open', 'high', 'low', 'close', 'volume'].includes(lower)) {
    return createComponentTemplate('price', {
      alias: raw.toUpperCase(),
      output_key: lower,
      params: { field: lower },
    });
  }

  return createComponentTemplate('custom', {
    alias: raw,
    output_key: slugify(raw),
    params: { expression: raw },
  });
};

const parseMetadata = (specObj) => {
  const meta = { ...DEFAULT_SPEC_META };
  SPEC_META_FIELDS.forEach(({ name }) => {
    if (specObj[name] != null) {
      meta[name] = String(specObj[name]);
    } else if (specObj.metadata && specObj.metadata[name] != null) {
      meta[name] = String(specObj.metadata[name]);
    }
  });
  return meta;
};

export const extractSpecState = (specValue) => {
  const specObject = parseSpecObject(specValue);
  const metadata = parseMetadata(specObject);
  let components = [];
  if (Array.isArray(specObject.components)) {
    components = normalizeComponentList(specObject.components);
  } else if (Array.isArray(specObject.features)) {
    components = normalizeComponentList(
      specObject.features
        .map((feature) => deriveComponentFromFeature(feature))
        .filter(Boolean),
    );
  }
  return { metadata, components };
};

export const autoOutputKey = (component) => {
  if (!component) return 'feature';
  if (component.output_key) return slugify(component.output_key);
  const params = component.params || {};
  switch (component.kind) {
    case 'price':
      return params.field || 'price';
    case 'indicator:rsi':
      return `rsi_${params.period || 14}`;
    case 'indicator:ema':
      return `ema_${params.period || 20}`;
    case 'indicator:sma':
      return `sma_${params.period || 50}`;
    case 'indicator:macd':
      return `macd_${params.fast || 12}_${params.slow || 26}_${params.signal || 9}`;
    case 'indicator:bb':
      return `bb_${params.period || 20}_${params.multiplier || 2}`;
    default:
      return slugify(component.alias || 'feature');
  }
};

export const buildSpecPayload = (metadata = {}, components = []) => {
  const metaClean = {};
  SPEC_META_FIELDS.forEach(({ name }) => {
    const value = metadata[name];
    if (value != null && String(value).trim().length) {
      metaClean[name] = String(value).trim();
    }
  });

  const normalizedComponents = normalizeComponentList(components).map(
    (component) => {
      const outputKey =
        String(component.output_key || '').trim() || autoOutputKey(component);
      return {
        id: component.id,
        alias: component.alias,
        kind: component.kind,
        include: component.include !== false,
        output_key: outputKey,
        params: component.params,
        notes: component.notes,
      };
    },
  );

  const features = normalizedComponents
    .filter((component) => component.include !== false)
    .map((component) => component.output_key || autoOutputKey(component));

  return {
    ...metaClean,
    metadata: metaClean,
    features,
    component_count: normalizedComponents.length,
    generated_at: new Date().toISOString(),
  };
};
