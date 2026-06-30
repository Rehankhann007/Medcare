// Central place that decides where API calls go.
//
// LOCAL DEV: VITE_API_URL is usually not set, so this falls back to '' (empty
// string), which means fetch('/api/...') stays relative — Vite's dev-server
// proxy (see vite.config.js) forwards that to http://localhost:5000.
//
// PRODUCTION (Vercel): VITE_API_URL must be set in Vercel's Environment
// Variables to your deployed backend URL, e.g.
//   VITE_API_URL=https://medcare-1tmn.onrender.com
// Vite's proxy does NOT exist in production builds, so without this the
// frontend would try to call its own Vercel domain for /api/... and fail
// with a network error.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Small wrapper around fetch that prefixes every relative '/api/...' or
// '/uploads/...' call with API_BASE_URL. Use this instead of calling
// fetch() directly so the base URL only has to be correct in one place.
export const apiFetch = (path, options) => {
  const url = path.startsWith('/') ? `${API_BASE_URL}${path}` : path;
  return fetch(url, options);
};
