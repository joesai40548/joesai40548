import { auth, onAuthStateChanged } from "./firebase-auth.js";

let sessionPromise = null;

function waitForSignedInUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      }
    }, (error) => {
      unsubscribe();
      reject(error);
    });
  });
}

export async function ensureFirebaseSession(_baseUrl, forceRefresh = false) {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const user = await waitForSignedInUser();
    const idToken = await user.getIdToken(forceRefresh);
    return { uid: user.uid, idToken };
  })().finally(() => {
    sessionPromise = null;
  });
  return sessionPromise;
}

export async function authenticatedFetch(url, options = {}) {
  const baseUrl = new URL(url).origin;
  const session = await ensureFirebaseSession(baseUrl);
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${session.idToken}`);
  headers.delete("x-user-id");

  const response = await fetch(url, { ...options, headers });
  if (response.status !== 401 || url.includes("/api/auth/")) return response;

  const refreshed = await ensureFirebaseSession(baseUrl, true);
  const retryHeaders = new Headers(options.headers || {});
  retryHeaders.set("Authorization", `Bearer ${refreshed.idToken}`);
  retryHeaders.delete("x-user-id");
  return fetch(url, { ...options, headers: retryHeaders });
}
