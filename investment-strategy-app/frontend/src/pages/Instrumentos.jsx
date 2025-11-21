// ============================================================================
// IMPORTACIONES
// ============================================================================
// React y sus hooks principales que usaremos para manejar el estado del componente
import React, { useEffect, useMemo, useState } from 'react';
// Estilos CSS específicos para esta página de instrumentos
import '../assets/css/Instrumentos.css';
// Estilos globales compartidos por toda la aplicación
import '../assets/globalAssets.css';
// Servicios HTTP especializados para instrumentos
import {
  fetchInstruments,
  createInstrument,
  updateInstrument,
  deleteInstrument,
} from '../services/instrumentApi';

// ============================================================================
// CONFIGURACIÓN DE CAMPOS DEL FORMULARIO
// ============================================================================
/**
 * FIELD_CONFIG: Array que define todos los campos que aparecerán en el formulario.
 * Cada objeto describe un campo con:
 *   - name: nombre del campo en el modelo de datos (debe coincidir con el backend)
 *   - label: etiqueta legible que se muestra al usuario
 *   - type: tipo de input HTML (text, number, datetime-local, etc.)
 *   - placeholder: texto de ayuda que aparece cuando el campo está vacío
 *   - step: (opcional) para campos numéricos, define el incremento/decremento
 */
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

// ============================================================================
// FUNCIONES AUXILIARES PARA MANEJO DE FORMULARIOS
// ============================================================================

/**
 * blankForm
 * Crea un objeto vacío con todos los campos definidos en FIELD_CONFIG.
 * Útil para inicializar formularios limpios.
 * 
 * @returns {Object} Objeto con todas las propiedades de FIELD_CONFIG inicializadas en ''
 * 
 * Ejemplo de salida:
 * { symbol: '', sec_type: '', exchange: '', currency: '', ... }
 */
const blankForm = () =>
  FIELD_CONFIG.reduce((acc, field) => {
    acc[field.name] = ''; // Inicializa cada campo en cadena vacía
    return acc;
  }, {});

/**
 * toDateInput
 * Convierte una fecha ISO (del backend) al formato que necesita un input datetime-local.
 * El formato requerido es: YYYY-MM-DDTHH:mm
 * 
 * @param {string|Date} value - Fecha en formato ISO o Date
 * @returns {string} Fecha formateada para datetime-local o '' si es inválida
 * 
 * Ejemplo:
 * toDateInput('2025-11-13T10:30:00.000Z') → '2025-11-13T10:30'
 */
const toDateInput = (value) => {
  if (!value) return ''; // Si no hay valor, retornar cadena vacía
  const date = new Date(value); // Crear objeto Date
  if (Number.isNaN(date.getTime())) return ''; // Validar que la fecha sea válida
  
  // Función auxiliar para agregar un cero adelante si el número es de un dígito
  const pad = (n) => `${n}`.padStart(2, '0');
  
  // Extraer componentes de la fecha
  const yyyy = date.getFullYear();        // Año (ej: 2025)
  const mm = pad(date.getMonth() + 1);    // Mes (0-11, por eso +1)
  const dd = pad(date.getDate());         // Día del mes
  const hh = pad(date.getHours());        // Hora
  const min = pad(date.getMinutes());     // Minutos
  
  // Retornar en formato YYYY-MM-DDTHH:mm
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

/**
 * buildFormFromInstrument
 * Toma un objeto instrumento del backend y lo convierte en un objeto
 * adecuado para rellenar los campos del formulario.
 * 
 * @param {Object} instrument - Objeto instrumento del backend
 * @returns {Object} Objeto con campos formateados para el formulario
 * 
 * Lógica:
 * 1. Inicia con un formulario vacío
 * 2. Para cada campo definido en FIELD_CONFIG:
 *    - Si el campo no existe en el instrumento, lo ignora
 *    - Si es una fecha, la convierte al formato datetime-local
 *    - Para otros campos, los convierte a string
 */
const buildFormFromInstrument = (instrument) => {
  const base = blankForm(); // Empezar con formulario vacío
  
  FIELD_CONFIG.forEach(({ name }) => {
    // Si el campo no existe o es null/undefined, saltarlo
    if (instrument[name] == null) return;
    
    // Campos de fecha requieren formato especial
    if (name === 'last_trade_date' || name === 'created_at') {
      base[name] = toDateInput(instrument[name]);
    } else {
      // Otros campos simplemente convertir a string
      base[name] = String(instrument[name]);
    }
  });
  
  return base;
};

/**
 * toNumberOrNull
 * Intenta convertir un valor a número. Si no es válido, retorna undefined.
 * Útil para campos numéricos del formulario.
 * 
 * @param {any} value - Valor a convertir
 * @returns {number|undefined} Número válido o undefined
 * 
 * Ejemplo:
 * toNumberOrNull('123') → 123
 * toNumberOrNull('abc') → undefined
 * toNumberOrNull('') → undefined
 */
const toNumberOrNull = (value) => {
  // Si está vacío o es null/undefined, retornar undefined
  if (value === '' || value == null) return undefined;
  
  const num = Number(value); // Intentar convertir a número
  
  // Verificar que sea un número finito (no NaN, Infinity, etc.)
  return Number.isFinite(num) ? num : undefined;
};

/**
 * toISOOrNull
 * Convierte un valor de datetime-local a formato ISO para enviar al backend.
 * 
 * @param {string} value - Valor del input datetime-local
 * @returns {string|undefined} Fecha en formato ISO o undefined si es inválida
 * 
 * Ejemplo:
 * toISOOrNull('2025-11-13T10:30') → '2025-11-13T10:30:00.000Z'
 */
const toISOOrNull = (value) => {
  if (!value) return undefined; // Si está vacío, retornar undefined
  
  const date = new Date(value); // Crear objeto Date
  
  // Validar que la fecha sea válida antes de convertir a ISO
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/**
 * sanitizePayload
 * Prepara los datos del formulario para enviarlos al backend.
 * Elimina campos vacíos, convierte números y fechas al formato correcto.
 * 
 * @param {Object} formState - Estado actual del formulario
 * @returns {Object} Objeto limpio listo para enviar al backend
 * 
 * Lógica:
 * 1. Itera sobre cada campo del formulario
 * 2. Ignora campos vacíos o null
 * 3. Convierte campos numéricos (ib_conid, underlying_conid) a números
 * 4. Convierte campos de fecha a formato ISO
 * 5. Deja el resto como string
 */
const sanitizePayload = (formState) => {
  const payload = {}; // Objeto resultado
  
  Object.entries(formState).forEach(([key, value]) => {
    // Ignorar campos vacíos o null
    if (value === '' || value == null) return;
    
    // Campos numéricos especiales
    if (key === 'ib_conid' || key === 'underlying_conid') {
      const num = toNumberOrNull(value);
      if (num != null) payload[key] = num; // Solo agregar si es número válido
      return;
    }
    
    // Campos de fecha
    if (key === 'last_trade_date' || key === 'created_at') {
      const iso = toISOOrNull(value);
      if (iso) payload[key] = iso; // Solo agregar si la fecha es válida
      return;
    }
    
    // Otros campos: mantener como string
    payload[key] = value;
  });
  
  return payload;
};

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
  
  /**
   * items: Array de instrumentos cargados desde el backend
   * Ejemplo: [{ ID: '1', symbol: 'AAPL', sec_type: 'STK', ... }, ...]
   */
  const [items, setItems] = useState([]);
  
  /**
   * loading: Indica si estamos cargando datos del backend
   * true: mostramos spinner o mensaje de carga
   * false: mostramos los datos o mensaje de error
   */
  const [loading, setLoading] = useState(true);
  
  /**
   * error: Mensaje de error si algo sale mal
   * Ejemplo: 'No se pudo cargar la lista'
   */
  const [error, setError] = useState('');
  
  /**
   * message: Mensaje de éxito para feedback al usuario
   * Ejemplo: 'Instrumento creado correctamente'
   */
  const [message, setMessage] = useState('');
  
  /**
   * expandedId: ID del instrumento que está actualmente expandido
   * null: ninguno expandido
   * string: ID del instrumento expandido
   */
  const [expandedId, setExpandedId] = useState(null);
  
  /**
   * editForms: Diccionario de formularios de edición por ID
   * Estructura: { 'id1': { symbol: 'AAPL', ... }, 'id2': { ... } }
   * Permite editar múltiples instrumentos sin que se interfieran
   */
  const [editForms, setEditForms] = useState({});
  
  /**
   * createForm: Estado del formulario de creación
   * Inicializado con blankForm() para tener todos los campos vacíos
   */
  const [createForm, setCreateForm] = useState(() => blankForm());
  
  /**
   * showCreate: Controla visibilidad del formulario de creación
   * false: formulario oculto
   * true: formulario visible
   */
  const [showCreate, setShowCreate] = useState(false);
  
  /**
   * submittingId: ID del instrumento que está siendo actualizado/eliminado
   * null: ninguna operación en progreso
   * string: ID del instrumento en operación (para deshabilitar botones)
   */
  const [submittingId, setSubmittingId] = useState(null);
  
  /**
   * submittingCreate: Indica si se está enviando el formulario de creación
   * Usado para deshabilitar el botón de crear mientras se procesa
   */
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // ============================================================================
  // VALORES COMPUTADOS (useMemo)
  // ============================================================================
  
  /**
   * emptyState: Indica si no hay instrumentos para mostrar
   * true: si no está cargando Y no hay items
   * false: si está cargando O hay items
   * 
   * Útil para mostrar mensaje "No hay instrumentos registrados"
   */
  const emptyState = useMemo(
    () => !loading && !items.length,
    [loading, items.length] // Solo recalcular si cambia loading o cantidad de items
  );
  
  /**
   * groupedItems: Agrupa instrumentos por tipo (sec_type)
   * Estructura: { 'STK': [ins1, ins2], 'FUT': [ins3], 'Otros': [ins4] }
   * 
   * Lógica:
   * 1. Usar 'Otros' si sec_type es null/vacío
   * 2. Acumular instrumentos en su grupo correspondiente
   */
  const groupedItems = useMemo(() => {
    // Si no hay items, retornar objeto vacío
    if (!items || items.length === 0) return {};

    // reduce acumula los items en grupos
    return items.reduce((acc, item) => {
      const key = item.sec_type || 'Otros'; // Tipo del instrumento o 'Otros'
      
      // Si el grupo no existe, crearlo
      if (!acc[key]) {
        acc[key] = [];
      }
      
      // Agregar item al grupo
      acc[key].push(item);
      
      return acc;
    }, {}); // Iniciar con objeto vacío
  }, [items]); // Recalcular solo cuando cambia items

  /**
   * sortedGroupKeys: Array de tipos (keys) ordenados alfabéticamente
   * Ejemplo: ['ETF', 'FUT', 'OPT', 'Otros', 'STK']
   * 
   * Permite mostrar los grupos en orden consistente en la UI
   */
  const sortedGroupKeys = useMemo(
    () => Object.keys(groupedItems).sort(),
    [groupedItems] // Recalcular cuando cambian los grupos
  );
  
  /**
   * tiposInstrumento: Lista de opciones para el select de tipo
   * Array constante que no cambia, por eso useState sin setter
   */
  const [tiposInstrumento] = useState([
    { value: 'STK', label: 'Acción (STK)' },
    { value: 'FUT', label: 'Futuro (FUT)' },
    { value: 'OPT', label: 'Opción (OPT)' },
    { value: 'IND', label: 'Índice (IND)' },
    { value: 'ETF', label: 'Fondo (ETF)' },
  ]);

  // ============================================================================
  // FUNCIONES DE CARGA DE DATOS
  // ============================================================================
  
  /**
   * loadItems
   * Función asíncrona que carga la lista de instrumentos desde el backend.
   * 
   * Flujo:
   * 1. Activar loading
   * 2. Limpiar mensajes de error
   * 3. Intentar cargar datos con fetchInstruments()
   * 4. Si éxito: guardar en items
   * 5. Si error: extraer mensaje y guardarlo en error
   * 6. Finalmente: desactivar loading
   */
  const loadItems = async () => {
    setLoading(true);  // Mostrar indicador de carga
    setError('');      // Limpiar errores previos
    
    try {
      const data = await fetchInstruments(); // Llamar a la función de red
      // Asegurar que data sea array antes de guardar
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      // Extraer mensaje de error del objeto error (puede estar en varios lugares)
      const messageFromErr =
        err?.response?.data?.message ||  // Error del backend
        err?.response?.data?.error ||    // Error alternativo del backend
        err?.message ||                  // Mensaje de error de axios
        'No se pudo cargar la lista.';   // Fallback genérico
      
      setError(messageFromErr); // Guardar mensaje de error
    } finally {
      // finally se ejecuta siempre, haya error o no
      setLoading(false); // Ocultar indicador de carga
    }
  };

  // ============================================================================
  // EFECTOS (useEffect)
  // ============================================================================
  
  /**
   * Efecto 1: Cargar instrumentos al montar el componente
   * Se ejecuta una sola vez cuando el componente se renderiza por primera vez
   * Array de dependencias vacío [] indica que solo se ejecuta al montar
   */
  useEffect(() => {
    loadItems(); // Cargar lista de instrumentos
  }, []); // Sin dependencias = solo al montar

  /**
   * Efecto 2: Inicializar formulario de edición cuando se expande un instrumento
   * Se ejecuta cada vez que cambia expandedId o items
   * 
   * Lógica:
   * 1. Si no hay nada expandido, no hacer nada
   * 2. Si ya existe formulario para ese ID, no hacer nada
   * 3. Buscar el instrumento en items
   * 4. Crear formulario con buildFormFromInstrument
   * 5. Guardarlo en editForms
   */
  useEffect(() => {
    if (!expandedId) return; // Si no hay nada expandido, salir
    
    setEditForms((prev) => {
      // Si ya existe formulario para este ID, no recrearlo
      if (prev[expandedId]) return prev;
      
      // Buscar el instrumento actual en la lista
      const current = items.find((item) => item.ID === expandedId);
      if (!current) return prev; // Si no se encuentra, mantener estado anterior
      
      // Crear nuevo formulario y agregarlo al diccionario
      return {
        ...prev, // Mantener formularios existentes
        [expandedId]: buildFormFromInstrument(current) // Agregar nuevo formulario
      };
    });
  }, [expandedId, items]); // Ejecutar cuando cambie expandedId o items

  // ============================================================================
  // HANDLERS (funciones que responden a eventos de la UI)
  // ============================================================================
  
  /**
   * handleToggleExpand
   * Alterna el estado expandido/colapsado de un instrumento.
   * Si está expandido, lo colapsa. Si está colapsado, lo expande.
   * 
   * @param {string} id - ID del instrumento a alternar
   */
  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
    // prev === id ? null : id significa:
    // Si el que se clickeó ya estaba expandido (prev === id), colapsarlo (null)
    // Si era otro o ninguno, expandir este (id)
    
    setMessage(''); // Limpiar mensajes al expandir/colapsar
  };

  /**
   * handleEditChange
   * Maneja cambios en los campos del formulario de edición.
   * Actualiza solo el campo específico del formulario específico.
   * 
   * @param {string} id - ID del instrumento siendo editado
   * @param {string} field - Nombre del campo que cambió
   * @param {any} value - Nuevo valor del campo
   */
  const handleEditChange = (id, field, value) => {
    setEditForms((prev) => ({
      ...prev, // Mantener otros formularios sin cambios
      [id]: {
        ...(prev[id] || {}), // Mantener otros campos del formulario sin cambios
        [field]: value        // Actualizar solo este campo
      }
    }));
  };

  /**
   * handleCreateChange
   * Maneja cambios en los campos del formulario de creación.
   * Similar a handleEditChange pero más simple porque solo hay un formulario de creación.
   * 
   * @param {string} field - Nombre del campo que cambió
   * @param {any} value - Nuevo valor del campo
   */
  const handleCreateChange = (field, value) => {
    setCreateForm((prev) => ({
      ...prev,          // Mantener otros campos sin cambios
      [field]: value    // Actualizar solo este campo
    }));
  };

  /**
   * handleCreate
   * Maneja el envío del formulario de creación.
   * 
   * @param {Event} event - Evento del formulario
   * 
   * Flujo:
   * 1. Prevenir recarga de página (comportamiento por defecto del form)
   * 2. Activar estado de envío (deshabilitar botón)
   * 3. Limpiar mensajes previos
   * 4. Sanitizar datos del formulario
   * 5. Enviar al backend con createInstrument()
   * 6. Si éxito: agregar al inicio de items, limpiar formulario, mostrar mensaje, cerrar form
   * 7. Si error: mostrar mensaje de error
   * 8. Finalmente: desactivar estado de envío
   */
  const handleCreate = async (event) => {
    event.preventDefault(); // Prevenir recarga de página
    
    setSubmittingCreate(true); // Indicar que estamos enviando
    setMessage('');            // Limpiar mensajes previos
    setError('');
    
    try {
      // Preparar datos para enviar (limpiar, convertir tipos, etc.)
      const payload = sanitizePayload(createForm);
      
      // Enviar al backend
      const created = await createInstrument(payload);
      
      // Agregar el nuevo instrumento al inicio de la lista
      setItems((prev) => [created, ...prev]);
      
      // Limpiar formulario para crear otro
      setCreateForm(blankForm());
      
      // Mostrar mensaje de éxito
      setMessage('Instrumento creado correctamente.');
      
      // Cerrar el formulario de creación
      setShowCreate(false);
      
    } catch (err) {
      // Extraer mensaje de error
      const messageFromErr =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo crear el instrumento.';
      
      setError(messageFromErr);
      
    } finally {
      // Siempre desactivar estado de envío
      setSubmittingCreate(false);
    }
  };

  /**
   * handleUpdate
   * Maneja el envío del formulario de edición.
   * 
   * @param {Event} event - Evento del formulario
   * @param {string} id - ID del instrumento a actualizar
   * 
   * Flujo similar a handleCreate pero actualiza en lugar de crear
   */
  const handleUpdate = async (event, id) => {
    event.preventDefault();
    
    // Obtener el estado del formulario para este ID
    const formState = editForms[id];
    if (!formState) return; // Si no hay formulario, no hacer nada
    
    setSubmittingId(id); // Indicar qué instrumento se está actualizando
    setMessage('');
    setError('');
    
    try {
      // Preparar datos
      const payload = sanitizePayload(formState);
      
      // Enviar actualización al backend
      const updated = await updateInstrument(id, payload);
      
      // Actualizar el instrumento en la lista local
      setItems((prev) =>
        prev.map((item) =>
          item.ID === id
            ? { ...item, ...updated, ...payload } // Combinar datos actualizados
            : item // Mantener otros instrumentos sin cambios
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
      setSubmittingId(null); // Limpiar estado de envío
    }
  };

  /**
   * handleDelete
   * Maneja la eliminación de un instrumento.
   * 
   * @param {string} id - ID del instrumento a eliminar
   * 
   * Flujo:
   * 1. Pedir confirmación al usuario
   * 2. Si confirma, enviar DELETE al backend
   * 3. Si éxito: remover de items, limpiar formulario de edición, colapsar si estaba expandido
   * 4. Si error: mostrar mensaje
   */
  const handleDelete = async (id) => {
    // Confirmar con el usuario antes de eliminar
    if (!window.confirm('Eliminar este instrumento?')) return;
    
    setSubmittingId(id); // Indicar operación en progreso
    setMessage('');
    setError('');
    
    try {
      // Enviar DELETE al backend
      await deleteInstrument(id);
      
      // Remover de la lista local
      setItems((prev) => prev.filter((item) => item.ID !== id));
      
      // Limpiar formulario de edición asociado
      setEditForms((prev) => {
        const next = { ...prev };
        delete next[id]; // Eliminar entrada del diccionario
        return next;
      });
      
      setMessage('Instrumento eliminado.');
      
      // Si el instrumento eliminado estaba expandido, colapsar
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
        
        {/* Formulario solo visible si showCreate es true */}
        {showCreate && (
          <form className="instrument-form" onSubmit={handleCreate}>
            <div className="form-grid">
              {/* Mapear FIELD_CONFIG para generar campos dinámicamente */}
              {FIELD_CONFIG.map(({ name, label, type, placeholder, step }) => (
                <label key={name} className="form-field">
                  <span>{label}</span>
                  
                  {/* Campo especial para sec_type: select en lugar de input */}
                  {name === 'sec_type' ? (
                    <select
                      value={createForm[name]}
                      onChange={(event) => handleCreateChange(name, event.target.value)}
                    >
                      <option value="">Selecciona un tipo</option>
                      {/* Mapear opciones de tipos */}
                      {tiposInstrumento.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    /* Otros campos: input normal */
                    <input
                      type={type}
                      value={createForm[name]}
                      placeholder={placeholder}
                      step={step}
                      onChange={(event) => handleCreateChange(name, event.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            
            {/* Botón de submit */}
            <button type="submit" className="primary" disabled={submittingCreate}>
              {submittingCreate ? 'Guardando...' : 'Crear instrumento'}
            </button>
          </form>
        )}
      </section>

      {/* Mensajes de estado (loading, error, éxito, vacío) */}
      {loading && <div className="instrumentos-status">Cargando instrumentos...</div>}
      {error && !loading && <div className="instrumentos-status error">{error}</div>}
      {message && <div className="instrumentos-status success">{message}</div>}
      {emptyState && (
        <div className="instrumentos-status">Aun no hay instrumentos registrados.</div>
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
                const isExpanded = expandedId === item.ID; // ¿Está expandido?
                const formState = editForms[item.ID] || buildFormFromInstrument(item); // Formulario de edición
                
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
                            <span>
                              {item.last_trade_date
                                ? new Date(item.last_trade_date).toLocaleString()
                                : '-'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Formulario de edición */}
                        <form className="instrument-form" onSubmit={(event) => handleUpdate(event, item.ID)}>
                          <h4>Editar instrumento</h4>
                          
                          <div className="form-grid">
                            {/* Generar campos del formulario */}
                            {FIELD_CONFIG.map(({ name, label, type, placeholder, step }) => (
                              <label key={name} className="form-field">
                                <span>{label}</span>
                                
                                {/* Campo especial para sec_type */}
                                {name === 'sec_type' ? (
                                  <select
                                    value={formState[name] ?? ''}
                                    onChange={(event) =>
                                      handleEditChange(item.ID, name, event.target.value)
                                    }
                                  >
                                    <option value="">Selecciona un tipo</option>
                                    {tiposInstrumento.map((t) => (
                                      <option key={t.value} value={t.value}>
                                        {t.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  /* Otros campos */
                                  <input
                                    type={type}
                                    value={formState[name] ?? ''}
                                    placeholder={placeholder}
                                    step={step}
                                    onChange={(event) =>
                                      handleEditChange(item.ID, name, event.target.value)
                                    }
                                  />
                                )}
                              </label>
                            ))}
                          </div>
                          
                          {/* Botón de actualizar */}
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
