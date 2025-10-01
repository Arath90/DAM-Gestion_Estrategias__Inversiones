import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // ej: http://localhost:4004/odata/v4/catalog
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err?.response?.data?.error?.message || err.message
    console.error('API error:', msg)
    return Promise.reject(err)
  }
)

export default api
