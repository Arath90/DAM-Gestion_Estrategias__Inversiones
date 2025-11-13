import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from '../config/apiClient';
import { DEFAULT_ALGORITHM_PARAMS, mergeAlgorithmParams } from '../constants/algorithmDefaults';

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

const getErrorMessage = (err, fallback) => {
  const raw =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback;
  if (typeof raw === 'string') return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return fallback;
  }
};

export const buildInstrumentScope = (symbol, interval) => {
  if (!symbol) return null;
  return `${String(symbol).toUpperCase()}::${interval || 'default'}`;
};

export const useAlgorithmSettings = ({
  scopeType = 'instrument',
  scopeRef = null,
  instrumentKey = null,
  interval = '1hour',
}) => {
  const [state, setState] = useState({
    params: DEFAULT_ALGORITHM_PARAMS,
    recordId: null,
    loading: false,
    saving: false,
    error: '',
  });

  const hydratingRef = useRef(false);
  const debounceRef = useRef(null);
  const pendingParamsRef = useRef(null);
  const recordIdRef = useRef(null);

  const effectiveScopeType = scopeRef ? scopeType : 'instrument';

  const mergedParams = useMemo(
    () => mergeAlgorithmParams(state.params),
    [state.params],
  );

  const loadSettings = useCallback(async () => {
    if (!scopeRef) {
      recordIdRef.current = null;
      setState((prev) => ({
        ...prev,
        params: DEFAULT_ALGORITHM_PARAMS,
        recordId: null,
        loading: false,
        error: '',
      }));
      return;
    }
    hydratingRef.current = true;
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const params = {
        ...BASE_PARAMS,
        ProcessType: 'READ',
        $top: 1,
        scope_type: effectiveScopeType,
        scope_ref: scopeRef,
      };
      const { data } = await axios.get('/AlgorithmSettings', { params });
      const record = unwrap(data)[0];
      if (record) {
        recordIdRef.current = record.ID;
        setState({
          params: mergeAlgorithmParams(record.params_json || record.params || {}),
          recordId: record.ID,
          loading: false,
          saving: false,
          error: '',
        });
      } else {
        recordIdRef.current = null;
        setState({
          params: DEFAULT_ALGORITHM_PARAMS,
          recordId: null,
          loading: false,
          saving: false,
          error: '',
        });
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: getErrorMessage(err, 'No se pudieron obtener los parámetros del algoritmo.'),
      }));
    } finally {
      setTimeout(() => {
        hydratingRef.current = false;
      }, 0);
    }
  }, [scopeRef, effectiveScopeType]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingParamsRef.current = null;
    loadSettings();
  }, [loadSettings]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const persistSettings = useCallback(
    async (paramsPayload) => {
      if (!scopeRef) return;
      setState((prev) => ({ ...prev, saving: true, error: '' }));
      const payload = {
        scope_type: effectiveScopeType,
        scope_ref: scopeRef,
        strategy_id: effectiveScopeType === 'strategy' ? scopeRef : undefined,
        instrument_key: instrumentKey || undefined,
        interval,
        params_json: paramsPayload,
      };
      try {
        let response;
        if (recordIdRef.current) {
          const params = { ...BASE_PARAMS, ProcessType: 'UPDATE' };
          response = await axios.patch(
            `/AlgorithmSettings${keyFor(recordIdRef.current)}`,
            payload,
            { params },
          );
        } else {
          const params = { ...BASE_PARAMS, ProcessType: 'CREATE' };
          response = await axios.post('/AlgorithmSettings', payload, { params });
        }
        const saved = unwrap(response.data)[0] || payload;
        recordIdRef.current = saved.ID || recordIdRef.current;
        setState((prev) => ({
          ...prev,
          saving: false,
          recordId: saved.ID || recordIdRef.current,
          params: mergeAlgorithmParams(saved.params_json || paramsPayload),
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          saving: false,
          error: getErrorMessage(err, 'No se pudo guardar la configuración del algoritmo.'),
        }));
      }
    },
    [scopeRef, effectiveScopeType, instrumentKey, interval],
  );

  const queuePersist = useCallback(
    (paramsSnapshot) => {
      if (!scopeRef) return;
      pendingParamsRef.current = paramsSnapshot;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const snapshot = pendingParamsRef.current;
        pendingParamsRef.current = null;
        persistSettings(snapshot);
      }, 600);
    },
    [persistSettings, scopeRef],
  );

  const updateParams = (updater) => {
    setState((prev) => {
      const draft = typeof updater === 'function' ? updater(prev.params) : updater;
      const nextParams = mergeAlgorithmParams(draft);
      if (!hydratingRef.current && scopeRef) {
        queuePersist(nextParams);
      }
      return { ...prev, params: nextParams };
    });
  };

  const updateParam = (field, value) => {
    updateParams((prevParams) => ({
      ...prevParams,
      [field]: value,
    }));
  };

  const updateDivergenceParam = (field, value) => {
    updateParams((prevParams) => ({
      ...prevParams,
      divergence: {
        ...(prevParams.divergence || DEFAULT_ALGORITHM_PARAMS.divergence),
        [field]: value,
      },
    }));
  };

  return {
    params: mergedParams,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    updateParam,
    updateDivergenceParam,
    refresh: loadSettings,
    scopeType: effectiveScopeType,
    scopeRef,
  };
};

