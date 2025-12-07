// Base primaria según entorno
const inferredApiUrl = (() => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || ''
    if (host.includes('netlify.app')) return '/api'
  }
  return 'http://localhost:4000'
})()

export const API_URL = inferredApiUrl

// Lista de posibles endpoints (proxy Netlify, Render y local)
const FALLBACK_ENDPOINTS = (() => {
  const list = [API_URL]
  if (!list.includes('/api')) list.push('/api')
  const renderUrl = 'https://pliqo-backend.onrender.com'
  if (!list.includes(renderUrl)) list.push(renderUrl)
  const localUrl = 'http://localhost:4000'
  if (!list.includes(localUrl)) list.push(localUrl)
  return list
})()

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let lastErr = null
  for (const base of FALLBACK_ENDPOINTS) {
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Error ${res.status}`)
      }
      return await res.json()
    } catch (e) {
      lastErr = e
      // Continuar con el siguiente endpoint
    }
  }
  throw new Error(lastErr?.message || 'Error de red intentando contactar la API')
}