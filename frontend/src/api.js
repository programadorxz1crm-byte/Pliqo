// Detectar entorno automáticamente: en Netlify usar proxy /api, local usar localhost
const inferredApiUrl = (() => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || ''
    if (host.includes('netlify.app')) return '/api'
  }
  return 'http://localhost:4000'
})()

export const API_URL = inferredApiUrl;

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }
  return res.json();
}