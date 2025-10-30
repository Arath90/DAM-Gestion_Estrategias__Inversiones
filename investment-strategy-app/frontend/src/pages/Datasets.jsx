import React, { useEffect, useMemo, useState } from 'react';
import '../assets/css/Datasets.css';
// import axios from '../config/apiClient'; // ← conéctalo cuando tengas backend

import DatasetCard from '../components/DatasetCard';

const FIELD_CONFIG = [
  { name: 'code', label: 'Código', type: 'text', placeholder: 'Ej. SP500_Daily_2024' },
  { name: 'name', label: 'Nombre', type: 'text', placeholder: 'Nombre legible' },
  { name: 'timeframe', label: 'Timeframe', type: 'text', placeholder: '1D / 1H' },
  { name: 'status', label: 'Estatus', type: 'text', placeholder: 'Active / Archived' },
  { name: 'tags', label: 'Etiquetas', type: 'text', placeholder: 'comma,separadas,por,comas' },
  { name: 'dateStart', label: 'Desde', type: 'date' },
  { name: 'dateEnd', label: 'Hasta', type: 'date' },
  { name: 'description', label: 'Descripción', as: 'textarea', placeholder: 'Breve descripción' },
];

const blankForm = () =>
  FIELD_CONFIG.reduce((acc, f) => ({ ...acc, [f.name]: '' }), {});

const Datasets = () => {
  // Estado base
  const [items, setItems] = useState([]);            // lista datasets
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Crear/editar
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(() => blankForm());
  const [editForms, setEditForms] = useState({});
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);

  // Filtros
  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTimeframe, setFilterTimeframe] = useState('');

  const emptyState = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  // ==========================
  // Stubs para integrar Backend
  // ==========================
  const fetchList = async () => {
    // TODO: reemplazar con llamada real (axios.get('/MLDatasets', { params }))
    // Simulación: carga vacía inicialmente
    return [];
  };

  const createDataset = async (payload) => {
    // TODO: axios.post('/MLDatasets', payload)
    console.log('createDataset()', payload);
    return { ID: crypto.randomUUID(), ...payload, updatedAt: new Date().toISOString() };
  };

  const updateDataset = async (id, payload) => {
    // TODO: axios.patch(`/MLDatasets(ID='${id}')`, payload)
    console.log('updateDataset()', id, payload);
    return { ID: id, ...payload, updatedAt: new Date().toISOString() };
  };

  const deleteDataset = async (id) => {
    // TODO: axios.delete(`/MLDatasets(ID='${id}')`)
    console.log('deleteDataset()', id);
  };

  // =============
  // Ciclo de vida
  // =============
  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchList();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'No se pudo cargar la lista.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  // =========
  // Handlers
  // =========
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
    setError(''); setMessage('');
    try {
      // Limpieza mínima
      const payload = { ...createForm };
      if (typeof payload.tags === 'string') {
        payload.tags = payload.tags.split(',').map(s => s.trim()).filter(Boolean);
      }
      const created = await createDataset(payload);
      setItems((prev) => [created, ...prev]);
      setCreateForm(blankForm());
      setShowCreate(false);
      setMessage('Dataset creado correctamente.');
    } catch (err) {
      setError(err?.message || 'No se pudo crear el dataset.');
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleUpdate = async (e, id) => {
    e.preventDefault();
    const formState = editForms[id];
    if (!formState) return;
    setSubmittingId(id);
    setError(''); setMessage('');
    try {
      const payload = { ...formState };
      if (typeof payload.tags === 'string') {
        payload.tags = payload.tags.split(',').map(s => s.trim()).filter(Boolean);
      }
      const updated = await updateDataset(id, payload);
      setItems((prev) => prev.map((it) => (it.ID === id ? { ...it, ...updated } : it)));
      setMessage('Dataset actualizado.');
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar el dataset.');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este dataset?')) return;
    setSubmittingId(id);
    setError(''); setMessage('');
    try {
      await deleteDataset(id);
      setItems((prev) => prev.filter((x) => x.ID !== id));
      setMessage('Dataset eliminado.');
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(err?.message || 'No se pudo eliminar el dataset.');
    } finally {
      setSubmittingId(null);
    }
  };

  // ==========
  // Derivados
  // ==========
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      const okQ =
        !needle ||
        [it.code, it.name, it.timeframe, (it.tags || []).join(',')]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(needle));

      const okStatus = !filterStatus || it.status === filterStatus;
      const okTf = !filterTimeframe || it.timeframe === filterTimeframe;

      return okQ && okStatus && okTf;
    });
  }, [items, q, filterStatus, filterTimeframe]);

  return (
    <div className="page-datasets">
      <header className="datasets-header">
        <h2>ML Datasets</h2>
        <p>Visualiza, filtra y administra los datasets para entrenamiento y backtesting (En desarrollo). </p>
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
            placeholder="Buscar por código, nombre o etiquetas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="form-field" style={{ minWidth: 180 }}>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Estatus (todos)</option>
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
            </select>
          </label>
          <label className="form-field" style={{ minWidth: 180 }}>
            <select
              value={filterTimeframe}
              onChange={(e) => setFilterTimeframe(e.target.value)}
            >
              <option value="">Timeframe (todos)</option>
              <option value="1D">1D</option>
              <option value="1H">1H</option>
              <option value="5m">5m</option>
            </select>
          </label>
        </div>
      </section>

      {showCreate && (
        <form className="dataset-form" onSubmit={handleCreate}>
          <h4>Nuevo dataset</h4>
          <div className="form-grid">
            {FIELD_CONFIG.map(({ name, label, type, placeholder, as }) => (
              <label key={name} className="form-field">
                <span>{label}</span>
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
                    onChange={(e) => handleCreateChange(name, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          <button className="btn-primary" type="submit" disabled={submittingCreate}>
            {submittingCreate ? 'Guardando…' : 'Crear dataset'}
          </button>
        </form>
      )}

      {loading && <div className="datasets-status">Cargando datasets…</div>}
      {error && !loading && <div className="datasets-status error">{error}</div>}
      {message && <div className="datasets-status success">{message}</div>}
      {emptyState && <div className="datasets-status">Aún no hay datasets registrados.</div>}

      <section className="datasets-list">
        {filtered.map((item) => {
          const isExpanded = expandedId === item.ID;
          const editState = editForms[item.ID] ?? {
            code: item.code || '',
            name: item.name || '',
            timeframe: item.timeframe || '',
            status: item.status || '',
            tags: Array.isArray(item.tags) ? item.tags.join(',') : (item.tags || ''),
            dateStart: item.dateStart || '',
            dateEnd: item.dateEnd || '',
            description: item.description || '',
          };
          return (
            <DatasetCard
              key={item.ID}
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
