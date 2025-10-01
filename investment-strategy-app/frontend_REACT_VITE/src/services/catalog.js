import api from '../config/apiClient'

// Util: arma key de OData con ID string
const key = (id) => `(ID='${encodeURIComponent(id)}')`

/** Lectura genérica con $top/$skip/$filter */
export const list = async (entity, { top = 20, skip = 0, filter } = {}) => {
  const params = new URLSearchParams()
  if (top) params.set('$top', top)
  if (skip) params.set('$skip', skip)
  if (filter) params.set('$filter', filter) // ej: symbol eq 'AAPL'

  const url = `/${entity}${params.toString() ? `?${params}` : ''}`
  const { data } = await api.get(url)
  // CAP OData devuelve { value: [...] } en V4
  return data?.value ?? data
}

/** Obtener uno por ID */
export const getById = async (entity, id) => {
  const { data } = await api.get(`/${entity}${key(id)}`)
  return data
}

/** Crear (CREATE) */
export const createOne = async (entity, payload) => {
  const { data } = await api.post(`/${entity}`, payload)
  return data
}

/** Actualizar (PATCH) */
export const updateOne = async (entity, id, payload) => {
  const { data } = await api.patch(`/${entity}${key(id)}`, payload)
  return data
}

/** Eliminar (DELETE) */
export const deleteOne = async (entity, id) => {
  await api.delete(`/${entity}${key(id)}`)
  return true
}

/** Helpers específicos (alias bonitos) */
export const InstrumentsAPI = {
  list: (opts) => list('Instruments', opts),
  get: (id) => getById('Instruments', id),
  create: (p) => createOne('Instruments', p),
  update: (id, p) => updateOne('Instruments', id, p),
  delete: (id) => deleteOne('Instruments', id),
}

export const CandlesAPI = {
  list: (opts) => list('Candles', opts),
  get: (id) => getById('Candles', id),
  create: (p) => createOne('Candles', p),
  update: (id, p) => updateOne('Candles', id, p),
  delete: (id) => deleteOne('Candles', id),
}

// Repite si quieres alias para: Orders, Positions, Signals, etc.
