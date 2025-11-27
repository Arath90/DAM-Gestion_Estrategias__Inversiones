// ============================================================================
// IMPORTACIONES
// ============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import '../assets/css/Instrumentos.css';
import '../assets/css/common.css';
import '../assets/globalAssets.css';
import { FormField, LoadingSpinner, ErrorMessage, EmptyState } from '../components/common';
import * as instrumentApi from '../services/instrumentApi';
import { createBlankForm, buildFormFromData, sanitizePayload } from '../utils/formHelpers';
import { formatDate } from '../utils/formatters';

// ============================================================================
// CONFIGURACIÓN DE CAMPOS DEL FORMULARIO
// ============================================================================
const FIELD_CONFIG = [
  { name: 'symbol', label: 'Simbolo', type: 'text', placeholder: 'Ej. AAPL', dataType: 'string' },
  { name: 'sec_type', label: 'Tipo', type: 'select', placeholder: 'STK / FUT / OPT', dataType: 'string' },
  { name: 'exchange', label: 'Exchange', type: 'text', placeholder: 'NYSE', dataType: 'string' },
  { name: 'currency', label: 'Moneda', type: 'text', placeholder: 'USD', dataType: 'string' },
  { name: 'multiplier', label: 'Multiplicador', type: 'text', placeholder: '1', dataType: 'string' },
  { name: 'trading_class', label: 'Clase', type: 'text', placeholder: 'NMS', dataType: 'string' },
  { name: 'ib_conid', label: 'CONID', type: 'number', placeholder: '123456', step: '1', dataType: 'number' },
  { name: 'underlying_conid', label: 'Subyacente CONID', type: 'number', placeholder: '0', step: '1', dataType: 'number' },
  { name: 'last_trade_date', label: 'Ultimo trade', type: 'datetime-local', dataType: 'date' },
  { name: 'created_at', label: 'Creado en origen', type: 'datetime-local', dataType: 'date' },
];

const TIPO_OPTIONS = [
  { value: 'STK', label: 'Acción (STK)' },
  { value: 'FUT', label: 'Futuro (FUT)' },
  { value: 'OPT', label: 'Opción (OPT)' },
  { value: 'IND', label: 'Índice (IND)' },
  { value: 'ETF', label: 'Fondo (ETF)' },
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

/**
 * Instrumentos
 * Componente React que maneja la interfaz de gestión de instrumentos financieros.
 * 
 * Funcionalidades:
 * - Listar instrumentos agrupados por tipo (STK, FUT, OPT, etc.)
 * - Crear nuevos instrumentos
 * - Editar instrumentos existentes
 * - Eliminar instrumentos
 * - Expandir/colapsar detalles de cada instrumento
 * 
 * Estados manejados:
 * - items: lista de instrumentos cargados
 * - loading: indica si está cargando datos
 * - error/message: mensajes de feedback al usuario
 * - expandedId: ID del instrumento actualmente expandido
 * - editForms: formularios de edición por ID
 * - createForm: formulario de creación
 * - showCreate: visibilidad del formulario de creación
 * - submittingId/submittingCreate: indica operaciones en progreso
 */
const Instrumentos = () => {
  // ============================================================================
  // ESTADOS DEL COMPONENTE
  // ============================================================================
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editForms, setEditForms] = useState({});
  const [createForm, setCreateForm] = useState(() => createBlankForm(FIELD_CONFIG));
  const [showCreate, setShowCreate] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // ============================================================================
  // VALORES COMPUTADOS (useMemo)
  // ============================================================================
  
  const emptyState = useMemo(() => !loading && !items.length, [loading, items.length]);
  
  const groupedItems = useMemo(() => {
    if (!items || items.length === 0) return {};
    return items.reduce((acc, item) => {
      const key = item.sec_type || 'Otros';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [items]);

  const sortedGroupKeys = useMemo(() => Object.keys(groupedItems).sort(), [groupedItems]);

  // ============================================================================
  // FUNCIONES DE CARGA DE DATOS
  // ============================================================================
  
  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await instrumentApi.fetchInstruments();
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

  // ============================================================================
  // EFECTOS (useEffect)
  // ============================================================================
  
  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (!expandedId) return;
    setEditForms((prev) => {
      if (prev[expandedId]) return prev;
      const current = items.find((item) => item.ID === expandedId);
      if (!current) return prev;
      return {
        ...prev,
        [expandedId]: buildFormFromData(current, FIELD_CONFIG)
      };
    });
  }, [expandedId, items]);

  // ============================================================================
  // HANDLERS (funciones que responden a eventos de la UI)
  // ============================================================================
  
  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setMessage('');
  };

  const handleEditChange = (id, field, value) => {
    setEditForms((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value }
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
      const payload = sanitizePayload(createForm, FIELD_CONFIG);
      const created = await instrumentApi.createInstrument(payload);
      setItems((prev) => [created, ...prev]);
      setCreateForm(createBlankForm(FIELD_CONFIG));
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
      const payload = sanitizePayload(formState, FIELD_CONFIG);
      const updated = await instrumentApi.updateInstrument(id, payload);
      setItems((prev) =>
        prev.map((item) =>
          item.ID === id ? { ...item, ...updated, ...payload } : item
        )
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
    if (!window.confirm('¿Eliminar este instrumento?')) return;
    
    setSubmittingId(id);
    setMessage('');
    setError('');
    
    try {
      await instrumentApi.deleteInstrument(id);
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

  // ============================================================================
  // RENDER (JSX)
  // ============================================================================
  
  return (
    <div className="page-instrumentos">
      {/* Cabecera de la página */}
      <header className="instrumentos-header">
        <h2>Instrumentos</h2>
        <p>Gestiona, crea y actualiza instrumentos sin usar tablas rigidas.</p>
      </header>

      {/* Sección del formulario de creación */}
      <section className="instrumentos-create">
        {/* Botón para mostrar/ocultar formulario */}
        <button
          type="button"
          className="toggle-create"
          onClick={() => setShowCreate((prev) => !prev)} // Alternar visibilidad
        >
          {showCreate ? 'Cerrar formulario' : 'Agregar nuevo instrumento'}
        </button>
        
        {showCreate && (
          <form className="instrument-form" onSubmit={handleCreate}>
            <div className="form-grid">
              {FIELD_CONFIG.map((field) => (
                <React.Fragment key={field.name}>
                  {field.type === 'select' ? (
                    <label className="form-field">
                      <span>{field.label}</span>
                      <select
                        value={createForm[field.name]}
                        onChange={(e) => handleCreateChange(field.name, e.target.value)}
                      >
                        <option value="">Selecciona un tipo</option>
                        {TIPO_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <FormField
                      label={field.label}
                      name={field.name}
                      type={field.type}
                      value={createForm[field.name]}
                      placeholder={field.placeholder}
                      step={field.step}
                      onChange={(e) => handleCreateChange(field.name, e.target.value)}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
            
            <button type="submit" className="primary" disabled={submittingCreate}>
              {submittingCreate ? 'Guardando...' : 'Crear instrumento'}
            </button>
          </form>
        )}
      </section>

      {/* Mensajes de estado */}
      {loading && <LoadingSpinner message="Cargando instrumentos..." />}
      {error && !loading && <ErrorMessage message={error} onDismiss={() => setError('')} />}
      {message && <ErrorMessage message={message} type="info" onDismiss={() => setMessage('')} />}
      {emptyState && (
        <EmptyState
          title="Sin instrumentos"
          message="Aún no hay instrumentos registrados. Crea uno usando el formulario."
          icon="📊"
        />
      )}

      {/* Lista de instrumentos agrupados */}
      <section className="instrumentos-list">
        {/* Iterar sobre los tipos ordenados */}
        {sortedGroupKeys.map((typeKey) => (
          <div key={typeKey} className="instrument-group-section">
            {/* Título del grupo con cantidad */}
            <h3>{typeKey} ({groupedItems[typeKey].length})</h3>
            
            <div className="instrument-group-list">
              {/* Iterar sobre instrumentos de este tipo */}
              {groupedItems[typeKey].map((item) => {
                const isExpanded = expandedId === item.ID;
                const formState = editForms[item.ID] || buildFormFromData(item, FIELD_CONFIG);
                
                return (
                  <article
                    key={item.ID}
                    className={`instrument-row${isExpanded ? ' expanded' : ''}`}
                  >
                    {/* Cabecera de la fila (siempre visible) */}
                    <header className="row-head">
                      {/* Botón para expandir/colapsar */}
                      <button
                        type="button"
                        className="row-toggle"
                        onClick={() => handleToggleExpand(item.ID)}
                      >
                        {/* Símbolo del instrumento */}
                        <span className="symbol">{item.symbol || 'Sin simbolo'}</span>
                        
                        {/* Metadatos (tipo, exchange, moneda) */}
                        <span className="meta">
                          {item.sec_type || 'N/D'} &middot; {item.exchange || 'Sin exchange'} &middot;{' '}
                          {item.currency || '-'}
                        </span>
                        
                        {/* Indicador visual de expandido */}
                        <span className="chevron" aria-hidden="true">
                          {isExpanded ? '^' : 'v'}
                        </span>
                      </button>
                      
                      {/* Botón de eliminar */}
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(item.ID)}
                        disabled={submittingId === item.ID}
                      >
                        {submittingId === item.ID ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </header>
                    
                    {/* Contenido expandido (solo si isExpanded es true) */}
                    {isExpanded && (
                      <div className="row-dropdown">
                        {/* Detalles del instrumento (solo lectura) */}
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
                            <span>{item.last_trade_date ? formatDate(item.last_trade_date) : '-'}</span>
                          </div>
                        </div>
                        
                        {/* Formulario de edición */}
                        <form className="instrument-form" onSubmit={(event) => handleUpdate(event, item.ID)}>
                          <h4>Editar instrumento</h4>
                          
                          <div className="form-grid">
                            {FIELD_CONFIG.map((field) => (
                              <React.Fragment key={field.name}>
                                {field.type === 'select' ? (
                                  <label className="form-field">
                                    <span>{field.label}</span>
                                    <select
                                      value={formState[field.name] ?? ''}
                                      onChange={(e) => handleEditChange(item.ID, field.name, e.target.value)}
                                    >
                                      <option value="">Selecciona un tipo</option>
                                      {TIPO_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : (
                                  <FormField
                                    label={field.label}
                                    name={field.name}
                                    type={field.type}
                                    value={formState[field.name] ?? ''}
                                    placeholder={field.placeholder}
                                    step={field.step}
                                    onChange={(e) => handleEditChange(item.ID, field.name, e.target.value)}
                                  />
                                )}
                              </React.Fragment>
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

// Exportar componente para uso en otras partes de la aplicación
export default Instrumentos;
