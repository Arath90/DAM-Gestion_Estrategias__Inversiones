import React, { useEffect, useMemo, useState } from 'react';
import '../assets/css/Instrumentos.css';
import '../assets/globalAssets.css';
import axios from '../config/apiClient';

const FIELD_CONFIG = [
  { name: 'symbol', label: 'Simbolo', type: 'text', placeholder: 'Ej. AAPL' },
  { name: 'sec_type', label: 'Tipo', type: 'text', placeholder: 'STK / FUT / OPT' },
  { name: 'exchange', label: 'Exchange', type: 'text', placeholder: 'NYSE' },
  { name: 'currency', label: 'Moneda', type: 'text', placeholder: 'USD' },
  { name: 'multiplier', label: 'Multiplicador', type: 'text', placeholder: '1' },
  { name: 'trading_class', label: 'Clase', type: 'text', placeholder: 'NMS' },
  { name: 'ib_conid', label: 'CONID', type: 'number', placeholder: '123456', step: '1' },
  { name: 'underlying_conid', label: 'Subyacente CONID', type: 'number', placeholder: '0', step: '1' },
  { name: 'last_trade_date', label: 'Ultimo trade', type: 'datetime-local' },
  { name: 'created_at', label: 'Creado en origen', type: 'datetime-local' },
];

const blankForm = () =>
  FIELD_CONFIG.reduce((acc, field) => {
    acc[field.name] = '';
    return acc;
  }, {});

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => `${n}`.padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const buildFormFromInstrument = (instrument) => {
  const base = blankForm();
  FIELD_CONFIG.forEach(({ name }) => {
    if (instrument[name] == null) return;
    if (name === 'last_trade_date' || name === 'created_at') {
      base[name] = toDateInput(instrument[name]);
    } else {
      base[name] = String(instrument[name]);
    }
  });
  return base;
};

const toNumberOrNull = (value) => {
  if (value === '' || value == null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const toISOOrNull = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const sanitizePayload = (formState) => {
  const payload = {};
  Object.entries(formState).forEach(([key, value]) => {
    if (value === '' || value == null) return;
    if (key === 'ib_conid' || key === 'underlying_conid') {
      const num = toNumberOrNull(value);
      if (num != null) payload[key] = num;
      return;
    }
    if (key === 'last_trade_date' || key === 'created_at') {
      const iso = toISOOrNull(value);
      if (iso) payload[key] = iso;
      return;
    }
    payload[key] = value;
  });
  return payload;
};

const BASE_PARAMS = { dbServer: 'MongoDB' };

const keyFor = (id) => `(ID='${encodeURIComponent(id)}')`;

const collectDataRes = (node) => {
  if (!node || typeof node !== 'object') return [];
  const bucket = [];

  if (Array.isArray(node.dataRes)) bucket.push(...node.dataRes);
  else if (node.dataRes && typeof node.dataRes === 'object') bucket.push(node.dataRes);

  if (Array.isArray(node.data)) {
    node.data.forEach((entry) => {
      bucket.push(...collectDataRes(entry));
    });
  }
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
  const params = {
    ...BASE_PARAMS,
    ProcessType: 'READ',
    $top: 50,
  };
  const { data } = await axios.get('/Instruments', { params });
  return unwrap(data);
};

const createInstrument = async (payload) => {
  const params = {
    ...BASE_PARAMS,
    ProcessType: 'CREATE',
  };
  const { data } = await axios.post('/Instruments', payload, { params });
  return unwrap(data)[0] || payload;
};

const updateInstrument = async (id, payload) => {
  const params = {
    ...BASE_PARAMS,
    ProcessType: 'UPDATE',
  };
  const { data } = await axios.patch(`/Instruments${keyFor(id)}`, payload, { params });
  return unwrap(data)[0] || payload;
};

const deleteInstrument = async (id) => {
  const params = {
    ...BASE_PARAMS,
    ProcessType: 'DELETE',
  };
  await axios.delete(`/Instruments${keyFor(id)}`, { params });
};

const Instrumentos = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editForms, setEditForms] = useState({});
  const [createForm, setCreateForm] = useState(() => blankForm());
  const [showCreate, setShowCreate] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const emptyState = useMemo(() => !loading && !items.length, [loading, items.length]);
  const groupedItems = useMemo(() => {
    if (!items || items.length === 0) return {};

    return items.reduce((acc, item) => {
      const key = item.sec_type || 'Otros'; // Usar 'Otros' si el tipo es nulo/vacío
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});
  }, [items]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedItems).sort(); // Ordenar los tipos (keys) alfabéticamente
  }, [groupedItems]);
  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchList();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const messageFromErr =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo cargar la lista.';
      setError(messageFromErr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (!expandedId) return;
    setEditForms((prev) => {
      if (prev[expandedId]) return prev;
      const current = items.find((item) => item.ID === expandedId);
      if (!current) return prev;
      return { ...prev, [expandedId]: buildFormFromInstrument(current) };
    });
  }, [expandedId, items]);

  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setMessage('');
  };

  const handleEditChange = (id, field, value) => {
    setEditForms((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const handleCreateChange = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSubmittingCreate(true);
    setMessage('');
    setError('');
    try {
      const payload = sanitizePayload(createForm);
      const created = await createInstrument(payload);
      setItems((prev) => [created, ...prev]);
      setCreateForm(blankForm());
      setMessage('Instrumento creado correctamente.');
      setShowCreate(false);
    } catch (err) {
      const messageFromErr =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo crear el instrumento.';
      setError(messageFromErr);
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleUpdate = async (event, id) => {
    event.preventDefault();
    const formState = editForms[id];
    if (!formState) return;
    setSubmittingId(id);
    setMessage('');
    setError('');
    try {
      const payload = sanitizePayload(formState);
      const updated = await updateInstrument(id, payload);
      setItems((prev) =>
        prev.map((item) => (item.ID === id ? { ...item, ...updated, ...payload } : item)),
      );
      setMessage('Instrumento actualizado.');
    } catch (err) {
      const messageFromErr =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo actualizar el instrumento.';
      setError(messageFromErr);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar este instrumento?')) return;
    setSubmittingId(id);
    setMessage('');
    setError('');
    try {
      await deleteInstrument(id);
      setItems((prev) => prev.filter((item) => item.ID !== id));
      setEditForms((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setMessage('Instrumento eliminado.');
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      const messageFromErr =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo eliminar el instrumento.';
      setError(messageFromErr);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="page-instrumentos">
      <header className="instrumentos-header">
        <h2>Instrumentos</h2>
        <p>Gestiona, crea y actualiza instrumentos sin usar tablas rigidas.</p>
      </header>

      <section className="instrumentos-create">
        <button
          type="button"
          className="toggle-create"
          onClick={() => setShowCreate((prev) => !prev)}
        >
          {showCreate ? 'Cerrar formulario' : 'Agregar nuevo instrumento'}
        </button>
        {showCreate && (
          <form className="instrument-form" onSubmit={handleCreate}>
            <div className="form-grid">
              {FIELD_CONFIG.map(({ name, label, type, placeholder, step }) => (
                <label key={name} className="form-field">
                  <span>{label}</span>
                  <input
                    type={type}
                    value={createForm[name]}
                    placeholder={placeholder}
                    step={step}
                    onChange={(event) => handleCreateChange(name, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <button type="submit" className="primary" disabled={submittingCreate}>
              {submittingCreate ? 'Guardando...' : 'Crear instrumento'}
            </button>
          </form>
        )}
      </section>

      {loading && <div className="instrumentos-status">Cargando instrumentos...</div>}
      {error && !loading && <div className="instrumentos-status error">{error}</div>}
      {message && <div className="instrumentos-status success">{message}</div>}
      {emptyState && (
        <div className="instrumentos-status">Aun no hay instrumentos registrados.</div>
      )}

      <section className="instrumentos-list">
        {sortedGroupKeys.map((typeKey) => (
          <div key={typeKey} className="instrument-group-section">
            <h3>{typeKey} ({groupedItems[typeKey].length})</h3>
            <div className="instrument-group-list">
              {groupedItems[typeKey].map((item) => {
                const isExpanded = expandedId === item.ID;
                const formState = editForms[item.ID] || buildFormFromInstrument(item);
                return (
                  <article
                    key={item.ID}
                    className={`instrument-row${isExpanded ? ' expanded' : ''}`}
                  >
                    <header className="row-head">
                      <button
                        type="button"
                        className="row-toggle"
                        onClick={() => handleToggleExpand(item.ID)}
                      >
                        <span className="symbol">{item.symbol || 'Sin simbolo'}</span>
                        <span className="meta">
                          {item.sec_type || 'N/D'} &middot; {item.exchange || 'Sin exchange'} &middot;{' '}
                          {item.currency || '-'}
                        </span>
                        <span className="chevron" aria-hidden="true">
                          {isExpanded ? '^' : 'v'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(item.ID)}
                        disabled={submittingId === item.ID}
                      >
                        {submittingId === item.ID ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </header>
                    {isExpanded && (
                      <div className="row-dropdown">
                        <div className="row-details">
                          <div>
                            <strong>ID</strong>
                            <span>{item.ID}</span>
                          </div>
                          <div>
                            <strong>Multiplicador</strong>
                            <span>{item.multiplier || '-'}</span>
                          </div>
                          <div>
                            <strong>Clase</strong>
                            <span>{item.trading_class || '-'}</span>
                          </div>
                          <div>
                            <strong>CONID</strong>
                            <span>{item.ib_conid ?? '-'}</span>
                          </div>
                          <div>
                            <strong>Subyacente</strong>
                            <span>{item.underlying_conid ?? '-'}</span>
                          </div>
                          <div>
                            <strong>Ultimo trade</strong>
                            <span>
                              {item.last_trade_date
                                ? new Date(item.last_trade_date).toLocaleString()
                                : '-'}
                            </span>
                          </div>
                        </div>
                        <form className="instrument-form" onSubmit={(event) => handleUpdate(event, item.ID)}>
                          <h4>Editar instrumento</h4>
                          <div className="form-grid">
                            {FIELD_CONFIG.map(({ name, label, type, placeholder, step }) => (
                              <label key={name} className="form-field">
                                <span>{label}</span>
                                <input
                                  type={type}
                                  value={formState[name] ?? ''}
                                  placeholder={placeholder}
                                  step={step}
                                  onChange={(event) =>
                                    handleEditChange(item.ID, name, event.target.value)
                                  }
                                />
                              </label>
                            ))}
                          </div>
                          <button type="submit" className="primary" disabled={submittingId === item.ID}>
                            {submittingId === item.ID ? 'Guardando...' : 'Actualizar'}
                          </button>
                        </form>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Instrumentos;
