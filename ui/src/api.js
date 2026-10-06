// The ONLY place the UI talks to the backend (Express on port 3000). Never to the databases directly.
export const api = (url, body) =>
  fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    .then((r) => r.json())
    .catch((e) => ({ error: String(e) }))
