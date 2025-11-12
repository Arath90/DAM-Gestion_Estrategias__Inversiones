import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../assets/css/Datasets.css';
import axios from '../config/apiClient';

import DatasetCard from '../components/DatasetCard';

const FIELD_CONFIG = [
  { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Ej. SP500_Daily_Features', required: true },
  { name: 'description', label: 'Descripción', as: 'textarea', placeholder: 'Breve descripción' },
  { name: 'instrument_conid', label: 'Instrumento CONID', type: 'number', placeholder: '123456', step: '1' },
  { name: 'spec_json', label: 'Spec JSON', as: 'textarea', placeholder: '{ "features": ["ema20", "macd"] }' },
];

const blankForm = () =>
  FIELD_CONFIG.reduce((acc, field) => {
    acc[field.name] = '';
    return acc;
  }, {});

const toReadableSpec = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const buildFormFromDataset = (item) => {
  const base = blankForm();
  FIELD_CONFIG.forEach(({ name }) => {
    if (item[name] == null) return;
    if (name === 'spec_json') {
      base[name] = toReadableSpec(item[name]);
    } else {
      base[name] = String(item[name]);
    }
  });
  return base;
};

const parseNumber = (value) => {
  if (value === '' || value == null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const sanitizePayload = (form) => {
  const payload = {};
  if (form.name && form.name.trim()) payload.name = form.name.trim();
  if (form.description && form.description.trim()) payload.description = form.description.trim();

  const conid = parseNumber(form.instrument_conid);
  if (conid != null) payload.instrument_conid = conid;

  if (form.spec_json && form.spec_json.trim()) {
    const trimmed = form.spec_json.trim();
    // Validamos JSON pero siempre enviamos string para cumplir con LargeString en CAP.
    try {
      JSON.parse(trimmed);
    } catch {
      // Si no es JSON válido igual permitimos guardarlo como texto describiendo el dataset.
    }
    payload.spec_json = trimmed;
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

const BASE_PARAMS = { dbServer: 'MongoDB' };
const keyFor = (id) => `(ID='${encodeURIComponent(id)}')`;

const collectDataRes = (node) => {
  if (!node || typeof node !== 'object') return [];
  const bucket = [];
  if (Array.isArray(node.dataRes)) bucket.push(...node.dataRes);
  else if (node.dataRes && typeof node.dataRes === 'object') bucket.push(node.dataRes);
  if (Array.isArray(node.data)) node.data.forEach((entry) => bucket.push(...collectDataRes(entry)));
  return bucket;
};

const normalizeResponse = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload.value)) {
    const collected = payload.value.flatMap(collectDataRes);
    return collected.length ? collected : payload.value;
  }
  const collected = collectDataRes(payload);
  if (collected.length) return collected;
  if (Array.isArray(payload)) return payload;
  if (payload.data) return normalizeResponse(payload.data);
  return [payload];
};

const unwrap = (payload) => {
  const arr = normalizeResponse(payload);
  return Array.isArray(arr) ? arr : arr ? [arr] : [];
};

const fetchList = async () => {
  const params = { ...BASE_PARAMS, ProcessType: 'READ', $top: 100 };
  const { data } = await axios.get('/MLDatasets', { params });
  return unwrap(data);
};

const createDataset = async (payload) => {
  const params = { ...BASE_PARAMS, ProcessType: 'CREATE' };
  const { data } = await axios.post('/MLDatasets', payload, { params });
  return unwrap(data)[0] || payload;
};

const updateDataset = async (id, payload) => {
  const params = { ...BASE_PARAMS, ProcessType: 'UPDATE' };
  const { data } = await axios.patch(`/MLDatasets${keyFor(id)}`, payload, { params });
  return unwrap(data)[0] || payload;
};

const deleteDataset = async (id) => {
  const params = { ...BASE_PARAMS, ProcessType: 'DELETE' };
  await axios.delete(`/MLDatasets${keyFor(id)}`, { params });
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

  const emptyState = useMemo(() => !loading && items.length === 0, [items.length, loading]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchList();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cargar la lista.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!expandedId) return;
    setEditForms((prev) => {
      if (prev[expandedId]) return prev;
      const current = items.find((x) => x.ID === expandedId);
      if (!current) return prev;
      return { ...prev, [expandedId]: buildFormFromDataset(current) };
    });
  }, [expandedId, items]);

  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setMessage('');
  };

  const handleCreateChange = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditChange = (id, field, value) => {
    setEditForms((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

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
      const created = await createDataset(payload);
      setItems((prev) => [created, ...prev]);
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
      const payload = sanitizePayload(formState);
      if (!payload.name) {
        setError('El nombre del dataset es obligatorio.');
        setSubmittingId(null);
        return;
      }
      const updated = await updateDataset(id, payload);
      setItems((prev) => prev.map((item) => (item.ID === id ? { ...item, ...updated } : item)));
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
      await deleteDataset(id);
      setItems((prev) => prev.filter((item) => item.ID !== id));
      setEditForms((prev) => {
        const next = { ...prev };
        delete next[id];
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
          <button className="btn-secondary" type="button" onClick={loadItems}>
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
                <span>{label} {name === 'name' ? '*' : ''}</span>
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
          <button className="btn-primary" type="submit" disabled={submittingCreate}>
            {submittingCreate ? 'Guardando...' : 'Crear dataset'}
          </button>
        </form>
      )}

      {loading && <div className="datasets-status">Cargando datasets...</div>}
      {error && !loading && <div className="datasets-status error">{error}</div>}
      {message && <div className="datasets-status success">{message}</div>}
      {emptyState && <div className="datasets-status">Aún no hay datasets registrados.</div>}

      <section className="datasets-list">
        {filtered.map((item, idx) => {
          const isExpanded = expandedId === item.ID;
          const editState =
            editForms[item.ID] ||
            buildFormFromDataset(item);
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
            />
          );
        })}
      </section>
    </div>
  );
};

export default Datasets;
