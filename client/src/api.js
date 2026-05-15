// Module-level token getter — set once by the auth-aware root component.
// All fetch calls go through apiFetch so the token is attached automatically.
let _getToken = null;

export function setTokenGetter(fn) {
  _getToken = fn;
}

export async function apiFetch(url, options = {}) {
  const token = _getToken ? await _getToken() : null;
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
