/**
 * Hook personalizado para manejo de operaciones CRUD genéricas
 */
import { useState, useCallback } from 'react';

/**
 * useCrud - Hook para operaciones CRUD con estado y manejo de errores
 * 
 * @param {Object} api - Objeto con métodos: fetch, create, update, delete
 * @returns {Object} Estado y funciones para CRUD
 */
export const useCrud = (api) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  /**
   * Carga todos los items
   */
  const fetchAll = useCallback(async (params = {}) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.fetch(params);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const errorMessage = err?.response?.data?.message || err.message || 'Error al cargar datos';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [api]);

  /**
   * Crea un nuevo item
   */
  const create = useCallback(async (payload) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const created = await api.create(payload);
      setItems(prev => [...prev, created]);
      setMessage('Creado exitosamente');
      return { success: true, data: created };
    } catch (err) {
      const errorMessage = err?.response?.data?.message || err.message || 'Error al crear';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [api]);

  /**
   * Actualiza un item existente
   */
  const update = useCallback(async (id, payload) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.update(id, payload);
      setItems(prev => prev.map(item => 
        item.ID === id ? { ...item, ...updated } : item
      ));
      setMessage('Actualizado exitosamente');
      return { success: true, data: updated };
    } catch (err) {
      const errorMessage = err?.response?.data?.message || err.message || 'Error al actualizar';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [api]);

  /**
   * Elimina un item
   */
  const remove = useCallback(async (id) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await api.delete(id);
      setItems(prev => prev.filter(item => item.ID !== id));
      setMessage('Eliminado exitosamente');
      return { success: true };
    } catch (err) {
      const errorMessage = err?.response?.data?.message || err.message || 'Error al eliminar';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [api]);

  /**
   * Limpia mensajes de error y éxito
   */
  const clearMessages = useCallback(() => {
    setError('');
    setMessage('');
  }, []);

  return {
    items,
    setItems,
    loading,
    error,
    message,
    fetchAll,
    create,
    update,
    remove,
    clearMessages,
  };
};
