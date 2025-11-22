import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../assets/css/Datasets.css';
import '../assets/css/common.css';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components/common';
import { createBlankForm, buildFormFromData } from '../utils/formHelpers';
import { toNumberOrNull } from '../utils/validation';

import {
  fetchDatasets as fetchDatasetsApi,
  createDataset as createDatasetApi,
  updateDataset as updateDatasetApi,
  deleteDataset as deleteDatasetApi,
  fetchDatasetModels,
  createDatasetModel,
  updateDatasetModel,
  deleteDatasetModel,
} from '../services/datasetApi';

import DatasetCard from '../components/DatasetCard';
import DatasetComponentsBuilder from '../components/DatasetComponentsBuilder';
import {
  DEFAULT_SPEC_META,
  SPEC_META_FIELDS,
  normalizeComponentList,
  extractSpecState,
} from '../utils/datasetSpec';

const FIELD_CONFIG = [
  { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Ej. SP500_Daily_Features', required: true },
  { name: 'description', label: 'Descripción', as: 'textarea', placeholder: 'Breve descripción' },
  { name: 'instrument_conid', label: 'Instrumento CONID', type: 'number', placeholder: '123456', step: '1' },
];

const defaultSpecMeta = () => ({ ...DEFAULT_SPEC_META });

const blankForm = () => {
  const base = createBlankForm(FIELD_CONFIG);
  base.specMeta = defaultSpecMeta();
  base.components = [];
  return base;
};

const buildFormFromDataset = (item, componentsOverride, metadataOverride) => {
  const base = buildFormFromData(item, FIELD_CONFIG);
  const { metadata, components } = extractSpecState(item.spec_json);
  base.specMeta = metadataOverride ?? metadata;
  base.components = componentsOverride ?? components;
  return base;
};

const sanitizePayload = (form, modelRef = null) => {
  const payload = {};
  if (form.name && form.name.trim()) payload.name = form.name.trim();
  if (form.description && form.description.trim()) payload.description = form.description.trim();

  const conid = toNumberOrNull(form.instrument_conid);
  if (conid != null) payload.instrument_conid = conid;

  if (modelRef) {
    payload.spec_json = JSON.stringify({ model_ref: modelRef });
  } else {
    payload.spec_json = JSON.stringify({});
  }

  return payload;
};

const getErrorMessage = (err, fallback) => {
  const raw =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback;
  if (!raw) return fallback;
  if (typeof raw === 'string') return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
};

const MODEL_TYPE = 'DATASET_COMPONENTS';

const buildModelPayload = ({ datasetId, datasetName, components, metadata }) => ({
  name: `${datasetName || datasetId} - components`,
  algo: MODEL_TYPE,
  trainedAt: new Date().toISOString(),
  metricsJson: JSON.stringify({
    model_type: MODEL_TYPE,
    dataset_id: datasetId,
    dataset_name: datasetName || '',
    components,
    metadata,
  }),
});

const syncModelComponents = async ({
  modelId,
  datasetId,
  datasetName,
  components,
  metadata,
}) => {
  const payload = buildModelPayload({
    datasetId,
    datasetName,
    components,
    metadata,
  });
  if (modelId) {
    return updateDatasetModel(modelId, payload);
  }
  return createDatasetModel(payload);
};

const parseComponentsArray = (value) => {
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

const parseLargeJSON = (value) => {
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

const parseMetadataJson = (value) => {
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

const Datasets = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(() => blankForm());
  const [editForms, setEditForms] = useState({});
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);

  const [q, setQ] = useState('');
  const [componentsMap, setComponentsMap] = useState({});
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [componentsError, setComponentsError] = useState('');

  const emptyState = useMemo(() => !loading && items.length === 0, [items.length, loading]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDatasetsApi();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cargar la lista.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComponents = useCallback(async () => {
    setComponentsLoading(true);
    setComponentsError('');
    try {
      const records = await fetchDatasetModels();
      const mapped = {};
      records.forEach((record) => {
        const metrics = parseLargeJSON(
          record.metricsJson || record.metrics_json || record.metrics,
        );
        if (metrics?.model_type !== MODEL_TYPE) return;
        const datasetIdRaw =
          metrics?.dataset_id ||
          metrics?.datasetId ||
          record.dataset_id ||
          record.datasetId;
        if (!datasetIdRaw) return;
        const datasetId = String(datasetIdRaw);
        mapped[datasetId] = {
          modelId: record.ID || record.id,
          components: normalizeComponentList(parseComponentsArray(metrics?.components)),
          metadata: parseMetadataJson(metrics?.metadata),
        };
      });
      setComponentsMap(mapped);
    } catch (err) {
      setComponentsError(getErrorMessage(err, 'No se pudieron cargar los componentes.'));
    } finally {
      setComponentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    loadComponents();
  }, [loadItems, loadComponents]);

  useEffect(() => {
    if (!expandedId) return;
    setEditForms((prev) => {
      if (prev[expandedId]) return prev;
      const current = items.find((x) => x.ID === expandedId);
      if (!current) return prev;
      const overrideComponents = componentsMap[expandedId]?.components;
      return { ...prev, [expandedId]: buildFormFromDataset(current, overrideComponents) };
    });
  }, [expandedId, items, componentsMap]);

  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setMessage('');
  };

  const getEditSnapshot = (forms, id, fallbackItem = null) => {
    const sourceItem = fallbackItem || items.find((x) => x.ID === id) || {};
    const mapEntry = componentsMap[String(id)];
    const base =
      forms[id] ||
      buildFormFromDataset(sourceItem, mapEntry?.components, mapEntry?.metadata);
    return {
      ...base,
      specMeta: base.specMeta || defaultSpecMeta(),
      components: Array.isArray(base.components) ? base.components : [],
    };
  };

  const handleCreateChange = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditChange = (id, field, value) => {
    setEditForms((prev) => ({
      ...prev,
      [id]: { ...getEditSnapshot(prev, id), [field]: value },
    }));
  };

  const handleCreateMetaChange = (field, value) => {
    setCreateForm((prev) => ({
      ...prev,
      specMeta: { ...(prev.specMeta || defaultSpecMeta()), [field]: value },
    }));
  };

  const handleEditMetaChange = (id, field, value) => {
    setEditForms((prev) => {
      const snapshot = getEditSnapshot(prev, id);
      return {
        ...prev,
        [id]: {
          ...snapshot,
          specMeta: { ...(snapshot.specMeta || defaultSpecMeta()), [field]: value },
        },
      };
    });
  };

  const handleCreateComponentsChange = (nextComponents) => {
    setCreateForm((prev) => ({
      ...prev,
      components: normalizeComponentList(nextComponents),
    }));
  };

  const handleEditComponentsChange = (id, nextComponents) => {
    setEditForms((prev) => {
      const snapshot = getEditSnapshot(prev, id);
      return {
        ...prev,
        [id]: {
          ...snapshot,
          components: normalizeComponentList(nextComponents),
        },
      };
    });
  };

  const persistComponentsForDataset = useCallback(
    async (datasetId, datasetName, specMeta, components, existingModelId = null) => {
      if (!datasetId) return;
      const datasetKey = String(datasetId);
      const normalizedComponents = normalizeComponentList(components || []);
      try {
        const record = await syncModelComponents({
          modelId: existingModelId,
          datasetId: datasetKey,
          datasetName,
          components: normalizedComponents,
          metadata: specMeta,
        });
        const resolvedId = record?.ID || record?.id || existingModelId || null;
        setComponentsMap((prev) => ({
          ...prev,
          [datasetKey]: {
            modelId: resolvedId,
            components: normalizedComponents,
            metadata: specMeta,
          },
        }));
        return resolvedId;
      } catch (err) {
        console.error('No se pudo sincronizar los componentes del dataset', err);
        throw err;
      }
    },
    [],
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmittingCreate(true);
    setError('');
    setMessage('');

    try {
      const payload = sanitizePayload(createForm);
      if (!payload.name) {
        setError('El nombre del dataset es obligatorio.');
        setSubmittingCreate(false);
        return;
      }
      const created = await createDatasetApi(payload);
      setItems((prev) => [created, ...prev]);
      const datasetId = created.ID || created.id || created._id;
      if (datasetId) {
        const datasetKey = String(datasetId);
        const modelId = await persistComponentsForDataset(
          datasetKey,
          created.name || payload.name || createForm.name,
          createForm.specMeta || defaultSpecMeta(),
          createForm.components,
          componentsMap[datasetKey]?.modelId,
        );
        if (modelId) {
          const specRef = JSON.stringify({ model_ref: modelId });
          await updateDatasetApi(datasetId, {
            spec_json: specRef,
          });
          setItems((prev) =>
            prev.map((item) =>
              item.ID === datasetId ? { ...item, spec_json: specRef } : item,
            ),
          );
        }
      }
      setCreateForm(blankForm());
      setShowCreate(false);
      setMessage('Dataset creado correctamente.');
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo crear el dataset.'));
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleUpdate = async (e, id) => {
    e.preventDefault();
    const formState = editForms[id];
    if (!formState) return;
    setSubmittingId(id);
    setError('');
    setMessage('');

    try {
      const datasetKey = String(id);
      const normalizedComponents = normalizeComponentList(formState.components);
      const modelId = await persistComponentsForDataset(
        datasetKey,
        formState.name,
        formState.specMeta || defaultSpecMeta(),
        normalizedComponents,
        componentsMap[datasetKey]?.modelId,
      );
      const payload = sanitizePayload(formState, modelId);
      if (!payload.name) {
        setError('El nombre del dataset es obligatorio.');
        setSubmittingId(null);
        return;
      }
      const updated = await updateDatasetApi(id, payload);
      setItems((prev) => prev.map((item) => (item.ID === id ? { ...item, ...updated } : item)));
      const merged = { ...(items.find((item) => item.ID === id) || {}), ...updated };
      setEditForms((prev) => ({
        ...prev,
        [id]: buildFormFromDataset(
          merged,
          normalizedComponents,
          formState.specMeta || defaultSpecMeta(),
        ),
      }));
      setComponentsMap((prev) => ({
        ...prev,
        [datasetKey]: {
          modelId,
          components: normalizedComponents,
          metadata: formState.specMeta || defaultSpecMeta(),
        },
      }));
      setMessage('Dataset actualizado correctamente.');
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo actualizar el dataset.'));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este dataset?')) return;
    setSubmittingId(id);
    setError('');
    setMessage('');
    try {
      await deleteDatasetApi(id);
      setItems((prev) => prev.filter((item) => item.ID !== id));
      setEditForms((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      const datasetKey = String(id);
      const componentEntry = componentsMap[datasetKey];
      if (componentEntry?.modelId) {
        try {
          await deleteDatasetModel(componentEntry.modelId);
        } catch (err) {
          console.error('No se pudo eliminar el modelo asociado al dataset', err);
        }
      }
      setComponentsMap((prev) => {
        const next = { ...prev };
        delete next[datasetKey];
        return next;
      });
      if (expandedId === id) setExpandedId(null);
      setMessage('Dataset eliminado.');
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo eliminar el dataset.'));
    } finally {
      setSubmittingId(null);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) =>
      [it.name, it.description, it.instrument_conid, JSON.stringify(it.spec_json)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [items, q]);

  return (
    <div className="page-datasets">
      <header className="datasets-header">
        <h2>ML Datasets</h2>
        <p>Administra los datasets utilizados para entrenamiento, backtesting y simulaciones.</p>
      </header>

      <section className="datasets-actions">
        <div className="left">
          <button className="btn-primary" type="button" onClick={() => setShowCreate((p) => !p)}>
            {showCreate ? 'Cerrar formulario' : 'Agregar dataset'}
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => {
              loadItems();
              loadComponents();
            }}
          >
            Refrescar
          </button>
        </div>
        <div className="right filters">
          <input
            className="input"
            placeholder="Buscar por nombre, descripción o CONID..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </section>

      {showCreate && (
        <form className="dataset-form" onSubmit={handleCreate}>
          <h4>Nuevo dataset</h4>
          <div className="form-grid">
            {FIELD_CONFIG.map(({ name, label, type, placeholder, as, step }) => (
              <label key={name} className="form-field">
                <span title={`Campo ${label}`}>{label} {name === 'name' ? '*' : ''}</span>
                {as === 'textarea' ? (
                  <textarea
                    value={createForm[name]}
                    placeholder={placeholder}
                    onChange={(e) => handleCreateChange(name, e.target.value)}
                  />
                ) : (
                  <input
                    type={type || 'text'}
                    value={createForm[name]}
                    placeholder={placeholder}
                    step={step}
                    onChange={(e) => handleCreateChange(name, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="spec-meta-grid">
            <h5>Metadatos del dataset</h5>
            <div className="form-grid">
              {SPEC_META_FIELDS.map(({ name, label, placeholder, as }) => (
                <label key={name} className="form-field">
                  <span title={`Valor para ${label}`}>{label}</span>
                  {as === 'textarea' ? (
                    <textarea
                      value={createForm.specMeta?.[name] ?? ''}
                      placeholder={placeholder}
                      onChange={(e) => handleCreateMetaChange(name, e.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      value={createForm.specMeta?.[name] ?? ''}
                      placeholder={placeholder}
                      onChange={(e) => handleCreateMetaChange(name, e.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
          <DatasetComponentsBuilder
            value={createForm.components}
            onChange={handleCreateComponentsChange}
          />
          <button className="btn-primary" type="submit" disabled={submittingCreate}>
            {submittingCreate ? 'Guardando...' : 'Crear dataset'}
          </button>
        </form>
      )}

      {loading && <LoadingSpinner message="Cargando datasets..." />}
      {componentsLoading && !loading && <LoadingSpinner message="Sincronizando componentes..." size="small" />}
      {error && !loading && <ErrorMessage message={error} onDismiss={() => setError('')} />}
      {componentsError && !loading && <ErrorMessage message={componentsError} onDismiss={() => setComponentsError('')} type="warning" />}
      {message && <ErrorMessage message={message} type="info" onDismiss={() => setMessage('')} />}
      {emptyState && (
        <EmptyState
          title="Sin datasets"
          message="Aún no hay datasets registrados. Crea uno usando el formulario."
          icon="📊"
        />
      )}

      <section className="datasets-list">
        {filtered.map((item, idx) => {
          const isExpanded = expandedId === item.ID;
          const editState = getEditSnapshot(editForms, item.ID, item);
          return (
            <DatasetCard
              key={item.ID || item._id || `dataset-${idx}`}
              item={item}
              isExpanded={isExpanded}
              onToggle={handleToggleExpand}
              onDelete={handleDelete}
              onChangeField={handleEditChange}
              onSubmitEdit={handleUpdate}
              editState={editState}
              submittingId={submittingId}
              FIELD_CONFIG={FIELD_CONFIG}
              onChangeMeta={handleEditMetaChange}
              onChangeComponents={handleEditComponentsChange}
              metadataFields={SPEC_META_FIELDS}
              componentsOverride={componentsMap[item.ID]?.components}
              metadataOverride={componentsMap[item.ID]?.metadata}
            />
          );
        })}
      </section>
    </div>
  );
};

export default Datasets;
