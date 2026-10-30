# Sandbox runtimes

Joes AI supports two complementary coding runtimes:

- **WebContainers** runs Node.js projects inside the browser. It needs the frontend origin to be cross-origin isolated. The `_headers` file configures COOP and COEP on static hosts that support that convention (including Cloudflare Pages and Netlify). GitHub Pages does not apply `_headers`; if the site is still served directly by GitHub Pages, move the frontend to a host that supports response headers or configure an edge proxy before WebContainers can boot. The app detects this and reports the missing headers rather than pretending execution succeeded.
- **E2B** runs JavaScript and Python inside isolated Firecracker microVMs managed by E2B Cloud.

## Backend configuration

Add this secret to the Render backend service:

- `E2B_API_KEY`: create an API key in the E2B dashboard. Keep it server-side; never put it in frontend config or commit it.

The API exposes authenticated endpoints under `/api/sandboxes/e2b`. Each sandbox is bound to the Firebase UID that created it and has a 15-minute lifetime. Use the Stop E2B control to terminate it early. Active sandbox IDs are held in backend process memory, so a backend restart ends the app's ability to reconnect to those sessions.

## WebContainers browser requirements

The website must be served over HTTPS with these response headers:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless` (or a compatible `require-corp` setup)

WebContainers currently requires browser support for cross-origin isolation and SharedArrayBuffer. Desktop Chromium browsers are the most reliable target; Firefox and Safari support remains more limited/beta. See [WebContainers browser support](https://webcontainers.io/guides/browser-support).

## Verification

After setting the E2B secret and deploying the backend, sign in to Joes AI, open a code block's Run action, and use **Run in E2B**. For WebContainers, confirm `window.crossOriginIsolated === true` in the browser console, then use **Run in WebContainers**.
