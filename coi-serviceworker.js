self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data === 'claim') event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  // Firebase signInWithPopup needs a live window.opener. Do not isolate the
  // dedicated OAuth page; the main app remains COOP/COEP isolated for WebContainers.
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.endsWith('/google-auth.html')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith((async () => {
    const response = await fetch(event.request);
    if (!response || response.type === 'opaqueredirect') return response;
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    headers.delete('content-length');
    headers.delete('content-encoding');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  })());
});
