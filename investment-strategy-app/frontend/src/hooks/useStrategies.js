import { useState, useEffect, useCallback } from 'react';
import api from '../config/apiClient';
import { STRATEGY_BASE_PARAMS } from '../constants/marketConstants';
import {
  attachStrategyKey,
  normalizeStrategiesResponse,
  getStrategyKey
} from '../utils/marketUtils';

/**
 * Hook para gestionar las estrategias de trading.
 * encapsula READ al catálogo /Strategies (CAP) y mantiene selección activa.
 */
export const useStrategies = () => {
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState('');
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState('');

  const fetchStrategiesCatalog = async () => {
    const { data } = await api.get('/Strategies', { params: STRATEGY_BASE_PARAMS });
    return attachStrategyKey(normalizeStrategiesResponse(data));
  };

  const loadStrategies = useCallback(async () => {
    setStrategiesLoading(true);
    setStrategiesError('');
    try {
      const catalog = await fetchStrategiesCatalog();
      setStrategies(Array.isArray(catalog) ? catalog.filter((item) => getStrategyKey(item)) : []);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No se pudieron cargar las estrategias.';
      setStrategiesError(message);
    } finally {
      setStrategiesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  useEffect(() => {
    if (!strategies.length) {
      setSelectedStrategyId('');
      return;
    }
    const exists = strategies.some((strategy) => getStrategyKey(strategy) === selectedStrategyId);
    if (!exists && strategies.length > 0) {
      setSelectedStrategyId(getStrategyKey(strategies[0]));
    }
  }, [strategies, selectedStrategyId]);

  const selectedStrategy = strategies.find((strategy) => getStrategyKey(strategy) === selectedStrategyId) || null;

  return {
    strategies,
    selectedStrategyId,
    setSelectedStrategyId,
    selectedStrategy,
    strategiesLoading,
    strategiesError,
    loadStrategies
  };
};
