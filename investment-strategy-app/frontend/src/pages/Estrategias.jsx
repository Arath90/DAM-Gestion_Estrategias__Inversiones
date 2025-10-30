import React, { useEffect, useMemo, useState } from 'react';
import '../assets/css/Estrategias.css';
import '../assets/globalAssets.css';
import axios from '../config/apiClient';

const FIELD_CONFIG = [
  { name: 'strategy_code', label: 'Código Estrategia', type: 'text', placeholder: 'STRAT-2025-001', required: true },
  { name: 'dataset_id', label: 'ID Dataset', type: 'text', placeholder: 'ObjectId de MLDataset', required: true },
  { name: 'period_start', label: 'Inicio periodo', type: 'datetime-local', required: true },
  { name: 'period_end', label: 'Fin periodo', type: 'datetime-local', required: true },
  { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Ej. Momentum US Equities' },
  { name: 'type', label: 'Tipo', as: 'select', options: [
    { value: '', label: 'Selecciona tipo' },
    { value: 'Reglas', label: 'Reglas' },
    { value: 'ML', label: 'ML' },
    { value: 'Discrecional', label: 'Discrecional' },
  ] },
  { name: 'status', label: 'Estado', as: 'select', options: [
    { value: '', label: 'Selecciona estado' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Live', label: 'Live' },
    { value: 'Paused', label: 'Paused' },
  ] },
  { name: 'owner', label: 'Propietario', type: 'text', placeholder: 'Equipo o usuario' },
  { name: 'frequency', label: 'Frecuencia', type: 'text', placeholder: '1D / 1H / Intradía' },
  { name: 'capitalAllocated', label: 'Capital asignado', type: 'number', placeholder: '0', step: '0.01' },
  { name: 'tags', label: 'Etiquetas', type: 'text', placeholder: 'coma,separadas,por,comas' },
  { name: 'description', label: 'Descripción', as: 'textarea', placeholder: 'Breve descripción' },
];

const blankForm = () =>
  FIELD_CONFIG.reduce((acc, field) => {
    acc[field.name] = '';
    return acc;
  }, {});

const pad2 = (n) => `${n}`.padStart(2, '0');
const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const buildFormFromStrategy = (item) => {
  const base = blankForm();
  FIELD_CONFIG.forEach(({ name }) => {
    if (item[name] == null) return;
    if (["period_start", "period_end"].includes(name)) base[name] = toDateInput(item[name]);
    else if (name === 'tags' && Array.isArray(item[name])) base[name] = item[name].join(',');
    else base[name] = String(item[name]);
  });
  return base;
};

const toNumberOrNull = (v) => {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const toISOOrNull = (v) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

const sanitizePayload = (form) => {
  const payload = {};
  Object.entries(form).forEach(([k, v]) => {
    if (v === '' || v == null) return;
    if (k === 'capitalAllocated') {
      const n = toNumberOrNull(v);
      if (n != null) payload[k] = n;
      return;
    }
    // Solo enviar period_start y period_end, NO createdAt ni updatedAt
    if (["period_start", "period_end"].includes(k)) {
      const iso = toISOOrNull(v);
      if (iso) payload[k] = iso;
      return;
    }
    if (k === 'tags') {
      const arr = String(v).split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length) payload[k] = arr;
      return;
    }
    payload[k] = v;
  });
  return payload;
};

// === Helpers de red (mismo patrón que Instrumentos) ===
const BASE_PARAMS = { dbServer: 'MongoDB' };
const keyFor = (id) => `(ID='${encodeURIComponent(id)}')`;

const collectDataRes = (node) => {
  if (!node || typeof node !== 'object') return [];
  const bucket = [];
  if (Array.isArray(node.dataRes)) bucket.push(...node.dataRes);
  else if (node.dataRes && typeof node.dataRes === 'object') bucket.push(node.dataRes);
  if (Array.isArray(node.data)) node.data.forEach((e) => bucket.push(...collectDataRes(e)));
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
const unwrap = (p) => {
  const arr = normalizeResponse(p);
  return Array.isArray(arr) ? arr : arr ? [arr] : [];
};

const fetchList = async () => {
  const params = { ...BASE_PARAMS, ProcessType: 'READ', $top: 50 };
  const { data } = await axios.get('/Strategies', { params });
  return unwrap(data);
};
const createStrategy = async (payload) => {
  const params = { ...BASE_PARAMS, ProcessType: 'CREATE' };
  const { data } = await axios.post('/Strategies', payload, { params });
  return unwrap(data)[0] || payload;
};
const updateStrategy = async (id, payload) => {
  const params = { ...BASE_PARAMS, ProcessType: 'UPDATE' };
  const { data } = await axios.patch(`/Strategies${keyFor(id)}`, payload, { params });
  return unwrap(data)[0] || payload;
};
const deleteStrategy = async (id) => {
  const params = { ...BASE_PARAMS, ProcessType: 'DELETE' };
  await axios.delete(`/Strategies${keyFor(id)}`, { params });
};

// === Componente ===
import StrategyCard from '../components/StrategyCard';

const Estrategias = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editForms, setEditForms] = useState({});
  const [createForm, setCreateForm] = useState(() => blankForm());
  const [showCreate, setShowCreate] = useState(false); // Asegura que el formulario de creación esté oculto por defecto
  const [submittingId, setSubmittingId] = useState(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const emptyState = useMemo(() => !loading && !items.length, [loading, items.length]);

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchList();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo cargar la lista.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, []);

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
    setMessage('');
  };

  const handleEditChange = (id, field, value) => {
    setEditForms((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleCreateChange = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const generateId = () => {
    // Genera un ID único simple (puedes cambiar por uuid si lo prefieres)
    return 'STRAT-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmittingCreate(true);
    setMessage('');
    setError('');
    try {
      const payload = sanitizePayload(createForm);
      // Validar que TODOS los campos obligatorios tengan valor
      const requiredFields = ['strategy_code', 'dataset_id', 'period_start', 'period_end'];
      const missingFields = requiredFields.filter((f) => !payload[f] || String(payload[f]).trim() === '');
      if (missingFields.length > 0) {
        setError('Completa todos los campos obligatorios (código, dataset, periodo) antes de crear la estrategia.');
        setSubmittingCreate(false);
        return;
      }
      // Si el usuario no puso un ObjectId válido, puedes agregar validación extra aquí
      // Si el modelo requiere un ID generado manualmente, descomenta la siguiente línea:
      // if (!payload.ID) { payload.ID = generateId(); }
      const created = await createStrategy(payload);
      setItems((prev) => [created, ...prev]);
      setCreateForm(blankForm());
      setMessage('Estrategia creada correctamente.');
      setShowCreate(false);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo crear la estrategia.';
      setError(msg);
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleUpdate = async (e, id) => {
    e.preventDefault();
    const formState = editForms[id];
    if (!formState) return;
    setSubmittingId(id);
    setMessage('');
    setError('');
    try {
      const payload = sanitizePayload(formState);
      const updated = await updateStrategy(id, payload);
      setItems((prev) =>
        prev.map((it) => (it.ID === id ? { ...it, ...updated, ...payload } : it)),
      );
      setMessage('Estrategia actualizada.');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo actualizar la estrategia.';
      setError(msg);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar esta estrategia?')) return;
    setSubmittingId(id);
    setMessage('');
    setError('');
    try {
      await deleteStrategy(id);
      setItems((prev) => prev.filter((x) => x.ID !== id));
      setEditForms((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setMessage('Estrategia eliminada.');
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo eliminar la estrategia.';
      setError(msg);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="page-estrategias">
      <header className="estrategias-header">
        <h2>Estrategias</h2>
        <p>Define, edita y monitorea estrategias con un flujo sencillo y sin tablas rígidas.</p>
      </header>

      <section className="estrategias-actions">
        <button type="button" className="toggle-create" onClick={() => setShowCreate((p) => !p)}>
          {showCreate ? 'Cerrar formulario' : 'Agregar nueva estrategia'}
        </button>
        {/* Filtros rápidos (placeholders visuales) */}
  <button type="button" className="btn-secondary" aria-label="Refrescar lista de estrategias" onClick={loadItems}>Refrescar</button>
      </section>

      {showCreate && (
        <form className="estrategia-form" onSubmit={handleCreate}>
          <h4>Nueva estrategia</h4>
          <div className="form-grid">
            {FIELD_CONFIG.map(({ name, label, type, placeholder, step, as, options }) => (
              <label key={name} className="form-field">
                <span>{label}</span>
                {as === 'textarea' ? (
                  <textarea
                    value={createForm[name]}
                    placeholder={placeholder}
                    onChange={(e) => handleCreateChange(name, e.target.value)}
                  />
                ) : as === 'select' ? (
                  <select
                    value={createForm[name]}
                    onChange={(e) => handleCreateChange(name, e.target.value)}
                  >
                    {options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={type || 'text'}
                    value={createForm[name]}
                    {...(['text', 'number', 'email', 'password', 'search', 'tel', 'url'].includes(type) && placeholder
                      ? { placeholder }
                      : {})}
                    step={step}
                    onChange={(e) => handleCreateChange(name, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          <button type="submit" className="primary" disabled={submittingCreate}>
            {submittingCreate ? 'Guardando...' : 'Crear estrategia'}
          </button>
        </form>
      )}

      {loading && <div className="estrategias-status">Cargando estrategias...</div>}
      {error && !loading && <div className="estrategias-status error">{error}</div>}
      {message && <div className="estrategias-status success">{message}</div>}
      {emptyState && <div className="estrategias-status">Aún no hay estrategias registradas.</div>}

      <section className="estrategias-list">
        {items.filter(item => !!item.ID).map((item, idx) => {
          const isExpanded = expandedId === item.ID;
          const formState = editForms[item.ID] || buildFormFromStrategy(item);
          return (
            <div key={item.ID || `estrategia-${idx}`} className="estrategia-card-wrapper">
              <StrategyCard
                item={item}
                isExpanded={isExpanded}
                onToggle={handleToggleExpand}
                onDelete={handleDelete}
                onChangeField={handleEditChange}
                onSubmitEdit={handleUpdate}
                editState={formState}
                submittingId={submittingId}
                FIELD_CONFIG={FIELD_CONFIG}
              />
              {/* Mostrar solo info de creado/actualizado si existen */}
              {isExpanded && (
                <div className="estrategia-meta">
                  {item.createdAt && (
                    <div><b>Creada:</b> {toDateInput(item.createdAt).replace('T', ' ')}</div>
                  )}
                  {item.updatedAt && (
                    <div><b>Actualizada:</b> {toDateInput(item.updatedAt).replace('T', ' ')}</div>
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
