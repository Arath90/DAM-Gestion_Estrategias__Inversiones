import React, { useCallback, useEffect, useMemo, useState } from "react";
import "../assets/css/Estrategias.css";
import "../assets/css/common.css";
import "../assets/globalAssets.css";
import {
  FormField,
  LoadingSpinner,
  ErrorMessage,
  EmptyState,
} from "../components/common";
import {
  createBlankForm,
  buildFormFromData,
  sanitizePayload as sanitizeFormPayload,
} from "../utils/formHelpers";
import { formatDate } from "../utils/formatters";
import {
  DEFAULT_INDICATOR_SETTINGS,
  DEFAULT_SIGNAL_CONFIG,
  INDICATOR_TOGGLES,
  STRATEGY_SIGNAL_FIELDS,
  describeIndicators,
  hydrateStrategyProfile,
} from "../constants/strategyProfiles";
import {
  INDICATOR_TOGGLE_TO_CONFIG,
  buildIndicatorDefaultParams,
} from "../constants/indicatorConfig";
import {
  fetchStrategies,
  fetchDatasets as fetchDatasetsApi,
  createStrategy as apiCreateStrategy,
  updateStrategy as apiUpdateStrategy,
  deleteStrategy as apiDeleteStrategy,
  fetchModelComponents as fetchModelComponentsApi,
} from "../services/strategyApi";
import {
  ALL_INDICATOR_KEYS,
  clampIndicatorSettings,
  deriveAllowedConfigKeys,
  deriveAllowedIndicatorKeys,
  buildDatasetComponentsMap,
  normalizeDatasetKey,
  shallowEqual,
} from "../utils/strategyIndicatorUtils";
import IndicatorParamsForm from "../components/IndicatorParamsForm";
import StrategyCard from "../components/StrategyCard"; // <-- mover import aquí
const FIELD_CONFIG = [
  {
    name: "strategy_code",
    label: "Código Estrategia",
    type: "text",
    placeholder: "STRAT-2025-001",
    required: true,
  },
  {
    name: "dataset_id",
    label: "Dataset",
    as: "select",
    options: [{ value: "", label: "Selecciona dataset" }],
    required: true,
  },
  {
    name: "period_start",
    label: "Inicio periodo",
    type: "datetime-local",
    required: true,
  },
  {
    name: "period_end",
    label: "Fin periodo",
    type: "datetime-local",
    required: true,
  },
  {
    name: "name",
    label: "Nombre",
    type: "text",
    placeholder: "Ej. Momentum US Equities",
  },
  {
    name: "type",
    label: "Tipo",
    as: "select",
    options: [
      { value: "", label: "Selecciona tipo" },
      { value: "Reglas", label: "Reglas" },
      { value: "ML", label: "ML" },
      { value: "Discrecional", label: "Discrecional" },
    ],
  },
  {
    name: "status",
    label: "Estado",
    as: "select",
    options: [
      { value: "", label: "Selecciona estado" },
      { value: "Draft", label: "Draft" },
      { value: "Live", label: "Live" },
      { value: "Paused", label: "Paused" },
    ],
  },
  {
    name: "owner",
    label: "Propietario",
    type: "text",
    placeholder: "Equipo o usuario",
  },
  {
    name: "frequency",
    label: "Frecuencia",
    type: "text",
    placeholder: "1D / 1H / Intradía",
  },
  {
    name: "capitalAllocated",
    label: "Capital asignado",
    type: "number",
    placeholder: "0",
    step: "0.01",
  },
  {
    name: "tags",
    label: "Etiquetas",
    type: "text",
    placeholder: "coma,separadas,por,comas",
  },
  {
    name: "description",
    label: "Descripción",
    as: "textarea",
    placeholder: "Breve descripción",
  },
];

const DEFAULT_INDICATOR_PARAM_VALUES = buildIndicatorDefaultParams();

const mergeIndicatorSettings = (value) => ({
  ...(value || {}),
});

const mergeSignalConfig = (value) => ({
  ...DEFAULT_SIGNAL_CONFIG,
  ...(value || {}),
});

const parseParamsBag = (value) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === "object") return { ...value };
  return {};
};

const getErrorMessage = (err, fallback) => {
  const raw =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback;
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw || fallback);
  }
};

const blankForm = () => {
  const base = createBlankForm(FIELD_CONFIG);
  base.indicator_settings = {};
  base.signal_config = { ...DEFAULT_SIGNAL_CONFIG };
  base.params_bag = {};
  base.indicator_params = {};
  return base;
};

const buildFormFromStrategy = (item) => {
  const base = buildFormFromData(item, FIELD_CONFIG);
  // Campos especiales
  if (item.tags && Array.isArray(item.tags)) base.tags = item.tags.join(",");
  if (item.dataset_id) {
    const datasetValue = item.dataset_id;
    if (typeof datasetValue === "object" && datasetValue !== null) {
      base.dataset_id =
        datasetValue.ID ||
        datasetValue._id ||
        datasetValue.id ||
        datasetValue.name ||
        "";
    } else {
      base.dataset_id = datasetValue != null ? String(datasetValue) : "";
    }
  }
  const { indicatorSettings, signalConfig, paramsBag } =
    hydrateStrategyProfile(item);
  base.indicator_settings = mergeIndicatorSettings(indicatorSettings);
  base.signal_config = mergeSignalConfig(signalConfig);
  base.params_bag = paramsBag;
  base.indicator_params = paramsBag.indicator_params || {};
  return base;
};

import { toNumberOrNull, toISOOrNull } from "../utils/validation";

const filterParamsByConfig = (indicatorParams = {}, allowedConfigKeys = []) => {
  if (!allowedConfigKeys.length) return { ...indicatorParams };
  const allowedPrefixes = new Set(
    allowedConfigKeys.map((k) => String(k).toUpperCase())
  );
  const next = {};
  Object.entries(indicatorParams || {}).forEach(([key, val]) => {
    const prefix = String(key).split("_")[0]?.toUpperCase();
    // Evitar duplicar umbrales RSI en indicator_params (ya viven en signal_config)
    if (
      prefix === "RSI" &&
      (key.toLowerCase().includes("overbought") ||
        key.toLowerCase().includes("oversold"))
    ) {
      return;
    }
    if (allowedPrefixes.has(prefix) && val !== "" && val != null) {
      next[key] = val;
    }
  });
  return next;
};

const buildFilteredSignalConfig = (
  rawSignalConfig = {},
  indicatorSettings = {}
) => {
  const merged = mergeSignalConfig(rawSignalConfig);
  const activeRSI = !!indicatorSettings.rsi;
  const activeMACD = !!indicatorSettings.macd;
  const activeEMA = !!indicatorSettings.ema20 && !!indicatorSettings.ema50;

  const next = {};
  // Flags según indicadores activos
  next.useEMA = activeEMA ? merged.useEMA !== false : false;
  next.useRSI = activeRSI ? merged.useRSI !== false : false;
  next.useMACD = activeMACD ? merged.useMACD !== false : false;

  // Valores específicos solo si aplica el indicador
  if (activeRSI) {
    next.rsiOversold = merged.rsiOversold;
    next.rsiOverbought = merged.rsiOverbought;
  }
  if (activeMACD) {
    next.macdHistogramThreshold = merged.macdHistogramThreshold;
  }

  // minReasons siempre útil para consistencia de señales
  next.minReasons = merged.minReasons;

  return next;
};

const sanitizePayload = (
  form,
  { allowedIndicatorKeys = ALL_INDICATOR_KEYS, allowedConfigKeys = [] } = {}
) => {
  const payload = {};
  const indicatorParams = filterParamsByConfig(
    form.indicator_params || {},
    allowedConfigKeys
  ); // limpia params
  const paramsBag = {
    ...parseParamsBag(form.params_bag),
  };
  const normalizedIndicatorSettings = clampIndicatorSettings(
    mergeIndicatorSettings(form.indicator_settings),
    allowedIndicatorKeys
  );
  const normalizedSignalConfig = buildFilteredSignalConfig(
    form.signal_config,
    normalizedIndicatorSettings
  );
  const mergedIndicatorParams = { ...indicatorParams };
  // Enriquecer params con valores relevantes de señal (solo si el indicador está activo)
  if (normalizedIndicatorSettings.rsi) {
    mergedIndicatorParams.RSI_overbought = normalizedSignalConfig.rsiOverbought;
    mergedIndicatorParams.RSI_oversold = normalizedSignalConfig.rsiOversold;
  }
  if (
    normalizedIndicatorSettings.macd &&
    normalizedSignalConfig.macdHistogramThreshold != null
  ) {
    mergedIndicatorParams.MACD_histogram_threshold =
      normalizedSignalConfig.macdHistogramThreshold;
  }

  Object.entries(form).forEach(([k, v]) => {
    if (v === "" || v == null) return;
    if (
      [
        "indicator_settings",
        "signal_config",
        "params_bag",
        "indicator_params",
      ].includes(k)
    )
      return;
    if (k === "capitalAllocated") {
      const n = toNumberOrNull(v);
      if (n != null) payload[k] = n;
      return;
    }
    if (["period_start", "period_end"].includes(k)) {
      const iso = toISOOrNull(v);
      if (iso) payload[k] = iso;
      return;
    }
    if (k === "tags") {
      const arr = String(v)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (arr.length) payload[k] = arr;
      return;
    }
    payload[k] = v;
  });

  const nextParams = {
    ...paramsBag,
    indicators: normalizedIndicatorSettings,
    indicator_params: mergedIndicatorParams,
  };
  payload.indicators =
    typeof normalizedIndicatorSettings === "string"
      ? normalizedIndicatorSettings
      : JSON.stringify(normalizedIndicatorSettings);
  payload.indicator_params =
    typeof mergedIndicatorParams === "string"
      ? mergedIndicatorParams
      : JSON.stringify(mergedIndicatorParams);

  return payload;
};

const sanitizeSignalValue = (
  field,
  rawValue,
  previous = DEFAULT_SIGNAL_CONFIG[field]
) => {
  if (rawValue === "" || rawValue == null) return previous;
  const num = Number(rawValue);
  if (!Number.isFinite(num)) return previous;
  if (field === "minReasons") return Math.max(1, Math.round(num));
  if (field === "macdHistogramThreshold") return Math.max(0, num);
  if (field === "rsiOversold" || field === "rsiOverbought") {
    const bounded = Math.min(100, Math.max(0, num));
    return field === "rsiOversold" ? Math.min(bounded, 100) : bounded;
  }
  return num;
};

// === Componente ===
const Estrategias = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [editForms, setEditForms] = useState({});
  const [createForm, setCreateForm] = useState(() => blankForm());
  const [showCreate, setShowCreate] = useState(false); // Asegura que el formulario de creación esté oculto por defecto
  const [submittingId, setSubmittingId] = useState(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetsError, setDatasetsError] = useState("");
  const [datasetComponentsMap, setDatasetComponentsMap] = useState({});
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [componentsError, setComponentsError] = useState("");

  const [indicatorParams, setIndicatorParams] = useState(() => ({
    ...DEFAULT_INDICATOR_PARAM_VALUES,
  }));

  // Manejador para cambiar los valores de los parámetros dinámicos
  const handleIndicatorParamChange = (id, value) => {
    setIndicatorParams((prev) => ({ ...prev, [id]: value }));
  };

  const emptyState = useMemo(
    () => !loading && !items.length,
    [loading, items.length]
  );
  const datasetOptions = useMemo(() => {
    const baseOption = datasetsLoading
      ? [{ value: "", label: "Cargando datasets..." }]
      : [
          {
            value: "",
            label: datasets.length
              ? "Selecciona dataset"
              : "Sin datasets disponibles",
          },
        ];
    const mapped = (datasets || []).map((dataset) => {
      const rawValue =
        dataset.ID || dataset._id || dataset.id || dataset.name || "";
      const value = String(rawValue);
      return {
        value,
        label: dataset.name || value,
      };
    });
    return [...baseOption, ...mapped];
  }, [datasets, datasetsLoading]);

  const normalizedCreateDatasetId = useMemo(
    () => normalizeDatasetKey(createForm.dataset_id),
    [createForm.dataset_id]
  );

  useEffect(() => {
    const allowedKeys = deriveAllowedIndicatorKeys(
      datasetComponentsMap,
      normalizedCreateDatasetId
    );
    setCreateForm((prev) => {
      const clamped = clampIndicatorSettings(
        prev.indicator_settings,
        allowedKeys
      );
      if (shallowEqual(prev.indicator_settings, clamped)) return prev;
      return { ...prev, indicator_settings: clamped };
    });
  }, [datasetComponentsMap, normalizedCreateDatasetId]);

  useEffect(() => {
    setEditForms((prev) => {
      let changed = false;
      const next = {};
      Object.entries(prev).forEach(([formId, formValue]) => {
        const allowed = deriveAllowedIndicatorKeys(
          datasetComponentsMap,
          formValue?.dataset_id
        );
        const clamped = clampIndicatorSettings(
          formValue?.indicator_settings || {},
          allowed
        );
        if (!shallowEqual(formValue?.indicator_settings || {}, clamped)) {
          changed = true;
          next[formId] = { ...formValue, indicator_settings: clamped };
        } else {
          next[formId] = formValue;
        }
      });
      return changed ? next : prev;
    });
  }, [datasetComponentsMap]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchStrategies();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo cargar la lista."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const loadDatasetComponents = useCallback(async () => {
    setComponentsLoading(true);
    setComponentsError("");
    try {
      const entries = await fetchModelComponentsApi();
      setDatasetComponentsMap(buildDatasetComponentsMap(entries));
    } catch (err) {
      setComponentsError(
        getErrorMessage(
          err,
          "No se pudieron cargar los indicadores permitidos."
        )
      );
    } finally {
      setComponentsLoading(false);
    }
  }, []);

  const loadDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    setDatasetsError("");
    try {
      const data = await fetchDatasetsApi();
      setDatasets(Array.isArray(data) ? data : []);
    } catch (err) {
      setDatasetsError(
        getErrorMessage(err, "No se pudo cargar la lista de datasets.")
      );
    } finally {
      setDatasetsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);
  useEffect(() => {
    loadDatasetComponents();
  }, [loadDatasetComponents]);

  useEffect(() => {
    if (!expandedId) return;
    setEditForms((prev) => {
      if (prev[expandedId]) return prev;
      const current = items.find((x) => x.ID === expandedId);
      if (!current) return prev;
      return { ...prev, [expandedId]: buildFormFromStrategy(current) };
    });
  }, [expandedId, items]);

  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setMessage("");
  };

  const handleEditChange = (id, field, value) => {
    setEditForms((prev) => {
      const snapshot = getEditSnapshot(prev, id);
      const nextForm = {
        ...snapshot,
        [field]: value,
      };
      if (field === "dataset_id") {
        nextForm.indicator_settings = clampIndicatorSettings(
          snapshot.indicator_settings,
          deriveAllowedIndicatorKeys(datasetComponentsMap, value)
        );
      }
      return { ...prev, [id]: nextForm };
    });
  };

  const handleCreateChange = (field, value) => {
    if (field === "dataset_id") {
      setCreateForm((prev) => ({
        ...prev,
        dataset_id: value,
        indicator_settings: clampIndicatorSettings(
          prev.indicator_settings,
          deriveAllowedIndicatorKeys(datasetComponentsMap, value)
        ),
      }));
      return;
    }
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const getEditSnapshot = (forms, id) =>
    forms[id] || buildFormFromStrategy(items.find((x) => x.ID === id) || {});

  const allowedToggleKeysForCreate = useMemo(
    () =>
      deriveAllowedIndicatorKeys(
        datasetComponentsMap,
        normalizedCreateDatasetId
      ),
    [datasetComponentsMap, normalizedCreateDatasetId]
  );

  const allowedConfigKeysForCreate = useMemo(
    () =>
      deriveAllowedConfigKeys(datasetComponentsMap, normalizedCreateDatasetId),
    [datasetComponentsMap, normalizedCreateDatasetId]
  );

  const activeIndicatorConfigKeysForCreate = useMemo(() => {
    const settings = createForm.indicator_settings || {};
    const activeToggles = Object.entries(settings)
      .filter(([, checked]) => !!checked)
      .map(([key]) => INDICATOR_TOGGLE_TO_CONFIG[key])
      .filter(Boolean);
    const uniqueKeys = [...new Set(activeToggles)];
    if (!allowedConfigKeysForCreate.length) return uniqueKeys;
    return uniqueKeys.filter((key) => allowedConfigKeysForCreate.includes(key));
  }, [createForm.indicator_settings, allowedConfigKeysForCreate]);

  const createIndicatorToggleList = useMemo(() => {
    const allowed = allowedToggleKeysForCreate;
    if (!allowed.length) return INDICATOR_TOGGLES;
    const filtered = INDICATOR_TOGGLES.filter(({ key }) =>
      allowed.includes(key)
    );
    return filtered.length ? filtered : INDICATOR_TOGGLES;
  }, [allowedToggleKeysForCreate]);

  const handleCreateIndicatorToggle = (key, checked) => {
    if (!allowedToggleKeysForCreate.includes(key)) return;
    setCreateForm((prev) => ({
      ...prev,
      indicator_settings: {
        ...(prev.indicator_settings || DEFAULT_INDICATOR_SETTINGS),
        [key]: checked,
      },
    }));
  };

  const handleEditIndicatorToggle = (id, key, checked) => {
    setEditForms((prev) => {
      const snapshot = getEditSnapshot(prev, id);
      const allowed = deriveAllowedIndicatorKeys(
        datasetComponentsMap,
        snapshot?.dataset_id
      );
      if (!allowed.includes(key)) return prev;
      return {
        ...prev,
        [id]: {
          ...snapshot,
          indicator_settings: {
            ...(snapshot.indicator_settings || DEFAULT_INDICATOR_SETTINGS),
            [key]: checked,
          },
        },
      };
    });
  };

  const handleCreateSignalConfigChange = (field, value) => {
    setCreateForm((prev) => ({
      ...prev,
      signal_config: {
        ...(prev.signal_config || DEFAULT_SIGNAL_CONFIG),
        [field]: sanitizeSignalValue(field, value, prev.signal_config?.[field]),
      },
    }));
  };

  const handleEditSignalConfigChange = (id, field, value) => {
    setEditForms((prev) => {
      const snapshot = getEditSnapshot(prev, id);
      const nextValue = sanitizeSignalValue(
        field,
        value,
        snapshot.signal_config?.[field]
      );
      return {
        ...prev,
        [id]: {
          ...snapshot,
          signal_config: {
            ...(snapshot.signal_config || DEFAULT_SIGNAL_CONFIG),
            [field]: nextValue,
          },
        },
      };
    });
  };

  const generateId = () => {
    // Genera un ID único simple (puedes cambiar por uuid si lo prefieres)
    return "STRAT-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmittingCreate(true);
    setMessage("");
    setError("");

    try {
      const allowedIndicatorKeys = deriveAllowedIndicatorKeys(
        datasetComponentsMap,
        createForm.dataset_id
      );
      const allowedConfigKeys = deriveAllowedConfigKeys(
        datasetComponentsMap,
        createForm.dataset_id
      );

      const formWithParams = {
        ...createForm,
        indicator_params: indicatorParams, // <-- Fusión de los parámetros dinámicos
      };
      const payload = sanitizePayload(formWithParams, {
        allowedIndicatorKeys,
        allowedConfigKeys,
      });
      // Validar que TODOS los campos obligatorios tengan valor
      const requiredFields = [
        "strategy_code",
        "dataset_id",
        "period_start",
        "period_end",
      ];
      const missingFields = requiredFields.filter(
        (f) => !payload[f] || String(payload[f]).trim() === ""
      );
      if (missingFields.length > 0) {
        setError(
          "Completa todos los campos obligatorios (código, dataset, periodo) antes de crear la estrategia."
        );
        setSubmittingCreate(false);
        return;
      }
      // Si el usuario no puso un ObjectId válido, puedes agregar validación extra aquí
      // Si el modelo requiere un ID generado manualmente, descomenta la siguiente línea:
      // if (!payload.ID) { payload.ID = generateId(); }
      const created = await apiCreateStrategy(payload);
      const merged = {
        ...payload,
        ...created,
      };
      setItems((prev) => [merged, ...prev]);
      setCreateForm(blankForm());
      setIndicatorParams({ ...DEFAULT_INDICATOR_PARAM_VALUES });
      setMessage("Estrategia creada correctamente.");
      setShowCreate(false);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo crear la estrategia."));
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleUpdate = async (e, id) => {
    e.preventDefault();
    const formState = editForms[id];
    if (!formState) return;
    setSubmittingId(id);
    setMessage("");
    setError("");
    try {
      const allowedIndicatorKeys = deriveAllowedIndicatorKeys(
        datasetComponentsMap,
        formState.dataset_id
      );
      const allowedConfigKeys = deriveAllowedConfigKeys(
        datasetComponentsMap,
        formState.dataset_id
      );
      const payload = sanitizePayload(formState, {
        allowedIndicatorKeys,
        allowedConfigKeys,
      });
      const updated = await apiUpdateStrategy(id, payload);
      const merged = {
        ...payload,
        ...updated,
      };
      setItems((prev) =>
        prev.map((it) => (it.ID === id ? { ...it, ...merged } : it))
      );
      const nextParamsBag = {}; // params_json ya no se utiliza
      setEditForms((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          params_bag: nextParamsBag,
        },
      }));
      setMessage("Estrategia actualizada.");
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo actualizar la estrategia."));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar esta estrategia?")) return;
    setSubmittingId(id);
    setMessage("");
    setError("");
    try {
      await apiDeleteStrategy(id);
      setItems((prev) => prev.filter((x) => x.ID !== id));
      setEditForms((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setMessage("Estrategia eliminada.");
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo eliminar la estrategia."));
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="page-estrategias">
      <header className="estrategias-header">
        <h2>Estrategias</h2>
        <p>
          Define, edita y monitorea estrategias con un flujo sencillo y sin
          tablas rígidas.
        </p>
      </header>

      <section className="estrategias-actions">
        <button
          type="button"
          className="toggle-create"
          onClick={() => setShowCreate((p) => !p)}
        >
          {showCreate ? "Cerrar formulario" : "Agregar nueva estrategia"}
        </button>

        <button
          type="button"
          className="btn-secondary"
          aria-label="Refrescar lista de estrategias"
          onClick={loadItems}
        >
          Refrescar
        </button>
      </section>
      {showCreate && (
        <form className="estrategia-form" onSubmit={handleCreate}>
          <h4>Nueva estrategia</h4>

          <div className="form-grid">
            {FIELD_CONFIG.map(
              ({ name, label, type, placeholder, step, as, options }) => {
                const isDatasetField = name === "dataset_id";
                const selectOptions = isDatasetField ? datasetOptions : options;
                const disabledSelect = isDatasetField && datasetsLoading;
                return (
                  <label key={name} className="form-field">
                    <span>{label}</span>
                    {as === "textarea" ? (
                      <textarea
                        value={createForm[name]}
                        placeholder={placeholder}
                        onChange={(e) =>
                          handleCreateChange(name, e.target.value)
                        }
                      />
                    ) : as === "select" ? (
                      <>
                        <select
                          value={createForm[name]}
                          onChange={(e) =>
                            handleCreateChange(name, e.target.value)
                          }
                          disabled={disabledSelect}
                        >
                          {(selectOptions || []).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {isDatasetField && datasetsError && (
                          <small className="form-hint error">
                            {datasetsError}
                          </small>
                        )}
                        {isDatasetField &&
                          !datasetsLoading &&
                          !datasets.length &&
                          !datasetsError && (
                            <small className="form-hint">
                              No hay datasets disponibles. Registra uno en la
                              sección Datasets.
                            </small>
                          )}
                      </>
                    ) : (
                      <input
                        type={type || "text"}
                        value={createForm[name]}
                        {...([
                          "text",
                          "number",
                          "email",
                          "password",
                          "search",
                          "tel",
                          "url",
                        ].includes(type) && placeholder
                          ? { placeholder }
                          : {})}
                        step={step}
                        onChange={(e) =>
                          handleCreateChange(name, e.target.value)
                        }
                      />
                    )}
                  </label>
                );
              }
            )}
          </div>
          <div className="strategy-config-block">
            <h5>Indicadores vinculados</h5>
            <div className="indicator-toggle-grid">
              {createIndicatorToggleList.map(({ key, label, icon }) => (
                <label key={key} className="indicator-toggle">
                  <input
                    type="checkbox"
                    checked={!!createForm.indicator_settings?.[key]}
                    disabled={!allowedToggleKeysForCreate.includes(key)}
                    onChange={(e) =>
                      handleCreateIndicatorToggle(key, e.target.checked)
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
          {activeIndicatorConfigKeysForCreate.length > 0 && (
            <div className="strategy-config-block">
              <h5>Parámetros de indicadores seleccionados</h5>
              {activeIndicatorConfigKeysForCreate.map((configKey) => (
                <IndicatorParamsForm
                  key={configKey}
                  indicatorKey={configKey}
                  params={indicatorParams}
                  onParamChange={handleIndicatorParamChange}
                  isEditing
                  withContainer={false}
                />
              ))}
            </div>
          )}

          <button type="submit" className="primary" disabled={submittingCreate}>
            {submittingCreate ? "Guardando..." : "Crear estrategia"}
          </button>
        </form>
      )}

      {loading && <LoadingSpinner message="Cargando estrategias..." />}
      {componentsLoading && !loading && (
        <LoadingSpinner
          message="Sincronizando indicadores permitidos..."
          size="small"
        />
      )}
      {error && !loading && (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      )}
      {componentsError && !componentsLoading && (
        <ErrorMessage
          message={componentsError}
          onDismiss={() => setComponentsError("")}
          type="warning"
        />
      )}
      {message && (
        <ErrorMessage
          message={message}
          type="info"
          onDismiss={() => setMessage("")}
        />
      )}
      {emptyState && (
        <EmptyState
          title="Sin estrategias"
          message="Aún no hay estrategias registradas. Crea una usando el formulario."
          icon="📈"
        />
      )}

      <section className="estrategias-list">
        {items
          .filter((item) => !!item.ID)
          .map((item, idx) => {
            const isExpanded = expandedId === item.ID;
            const formState = editForms[item.ID] || buildFormFromStrategy(item);
            return (
              <div
                key={item.ID || `estrategia-${idx}`}
                className="estrategia-card-wrapper"
              >
                <StrategyCard
                  item={item}
                  isExpanded={isExpanded}
                  onToggle={handleToggleExpand}
                  onDelete={handleDelete}
                  onChangeField={handleEditChange}
                  onChangeIndicatorSetting={handleEditIndicatorToggle}
                  onChangeSignalConfig={handleEditSignalConfigChange}
                  onSubmitEdit={handleUpdate}
                  editState={formState}
                  submittingId={submittingId}
                  FIELD_CONFIG={FIELD_CONFIG}
                  datasetOptions={datasetOptions}
                  datasetsLoading={datasetsLoading}
                  datasetComponentsMap={datasetComponentsMap}
                  datasetKeyOverride={formState.dataset_id}
                />
                {/* Mostrar solo info de creado/actualizado si existen */}
                {isExpanded && (
                  <div className="estrategia-meta">
                    {item.createdAt && (
                      <div>
                        <b>Creada:</b>{" "}
                        {formatDate(item.createdAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    )}
                    {item.updatedAt && (
                      <div>
                        <b>Actualizada:</b>{" "}
                        {formatDate(item.updatedAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </section>
    </div>
  );
};

export default Estrategias;
