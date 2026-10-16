export class ApiClientError extends Error {
    constructor(message, details) {
      super(message);
      this.details = details;
    }
  }
  
  export async function apiFetch(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new ApiClientError('Could not reach the server. Check your connection.');
    }
    if (res.status === 204) return null;
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiClientError(json?.error?.message ?? `Request failed (${res.status})`, json?.error?.details);
    }
    return json;
  }