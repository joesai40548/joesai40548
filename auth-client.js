const REFRESH_TOKEN_KEY = 'joes_ai_firebase_refresh_token';
let activeSession = null;
let sessionPromise = null;

async function authRequest(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Firebase authentication failed.');
  return data;
}

function rememberSession(data) {
  activeSession = {
    idToken: data.idToken,
    uid: data.uid,
    expiresAt: Date.now() + Math.max(60, Number(data.expiresIn) || 3600) * 1000
  };
  if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  localStorage.setItem('joes_ai_user_id', data.uid);
  return activeSession;
}

async function createAnonymousSession(baseUrl) {
  const data = await authRequest(`${baseUrl}/api/auth/anonymous`, {});
  return rememberSession(data);
}

async function refreshSession(baseUrl) {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return createAnonymousSession(baseUrl);
  try {
    const data = await authRequest(`${baseUrl}/api/auth/refresh`, { refreshToken });
    return rememberSession(data);
  } catch {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    activeSession = null;
    return createAnonymousSession(baseUrl);
  }
}

export async function ensureFirebaseSession(baseUrl, forceRefresh = false) {
  if (!forceRefresh && activeSession && activeSession.expiresAt > Date.now() + 60_000) return activeSession;
  if (sessionPromise) return sessionPromise;
  sessionPromise = refreshSession(baseUrl).finally(() => { sessionPromise = null; });
  return sessionPromise;
}

export async function authenticatedFetch(url, options = {}) {
  const baseUrl = new URL(url).origin;
  const session = await ensureFirebaseSession(baseUrl);
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${session.idToken}`);
  const response = await fetch(url, { ...options, headers });

  if (response.status !== 401 || url.includes('/api/auth/')) return response;

  const refreshed = await ensureFirebaseSession(baseUrl, true);
  const retryHeaders = new Headers(options.headers || {});
  retryHeaders.set('Authorization', `Bearer ${refreshed.idToken}`);
  return fetch(url, { ...options, headers: retryHeaders });
}
