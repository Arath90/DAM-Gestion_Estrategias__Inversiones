import api from '../config/apiClient'

export const odataNormalize = (data) => (Array.isArray(data?.value) ? data.value : data)
export const key = (id) => `(ID='${encodeURIComponent(id)}')`

export const odataList = async (entity, { top = 20, skip = 0, filter, orderby } = {}) => {
  const q = new URLSearchParams()
  if (top) q.set('$top', top)
  if (skip) q.set('$skip', skip)
  if (filter) q.set('$filter', filter)
  if (orderby) q.set('$orderby', orderby)
  const url = `/${entity}${q.toString() ? `?${q}` : ''}`
  const { data } = await api.get(url)
  return odataNormalize(data)
}

export const odataGet = async (entity, id) => {
  const { data } = await api.get(`/${entity}${key(id)}`)
  return data
}
export const odataCreate = async (entity, payload) => {
  const { data } = await api.post(`/${entity}`, payload)
  return data
}
export const odataPatch = async (entity, id, payload) => {
  const { data } = await api.patch(`/${entity}${key(id)}`, payload)
  return data
}
export const odataDelete = async (entity, id) => {
  await api.delete(`/${entity}${key(id)}`)
  return true
}

/* APIs específicas */
export const InstrumentsAPI = {
  list: (opts) => odataList('Instruments', opts),
  get: (id) => odataGet('Instruments', id),
  create: (p) => odataCreate('Instruments', p),
  update: (id, p) => odataPatch('Instruments', id, p),
  remove: (id) => odataDelete('Instruments', id),
}
