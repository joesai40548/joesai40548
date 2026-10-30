import { ensureFirebaseSession } from './auth-client.js';

const API_BASE = 'https://joes-ai-jlzt.onrender.com';
const byId = (id) => document.getElementById(id);
let webContainer = null;
let e2bSandboxId = null;
let webServerProcess = null;

function setStatus(message, isError = false) {
  const el = byId('sandbox-runtime-status');
  if (el) {
    el.textContent = message;
    el.className = 'text-xs mr-auto ' + (isError ? 'text-rose-300' : 'text-slate-300');
  }
}

function appendOutput(value) {
  const el = byId('sandbox-output');
  if (!el) return;
  const text = String(value ?? '');
  el.textContent = (el.textContent === 'Output will appear here.' ? '' : el.textContent) + text;
  el.scrollTop = el.scrollHeight;
}

function clearOutput() {
  const el = byId('sandbox-output');
  if (el) el.textContent = '';
}

async function api(path, options = {}) {
  const session = await ensureFirebaseSession(API_BASE);
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', 'Bearer ' + session.idToken);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(API_BASE + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Sandbox request failed (' + response.status + ').');
  return data;
}

async function pipeProcessOutput(process) {
  if (!process?.output) return;
  const reader = process.output.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    appendOutput(value);
  }
}

function projectFiles(code) {
  const isHtml = /<!doctype html|<html[\s>]|<body[\s>]|<div[\s>]|<main[\s>]|<section[\s>]|<h[1-6][\s>]|<script[\s>]/i.test(code);
  const html = isHtml
    ? code
    : '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Joes AI Preview</title></head><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>';
  const files = {
    'package.json': { file: { contents: JSON.stringify({ name: 'joes-ai-preview', private: true, version: '1.0.0', scripts: { dev: 'vite --host 0.0.0.0' }, devDependencies: { vite: '6.2.3' } }, null, 2) } },
    'index.html': { file: { contents: html } }
  };
  if (!isHtml) files.src = { directory: { 'main.js': { file: { contents: code } } } };
  return files;
}

async function runWebContainer() {
  const code = byId('sandbox-code-editor')?.value || '';
  if (!code.trim()) throw new Error('Enter some code before running it.');
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    throw new Error('WebContainers needs cross-origin isolation. The website host must send COOP: same-origin and COEP: require-corp (or credentialless) response headers. Reload the page once if the isolation service worker was just installed; if this persists, the hosting configuration is still missing the required headers.');
  }
  setStatus('Starting browser runtime…');
  clearOutput();
  if (webContainer) {
    try { webContainer.teardown(); } catch {}
    webContainer = null;
    webServerProcess = null;
  }
  const { WebContainer } = await import('https://esm.sh/@webcontainer/api@1.6.1');
  webContainer = await WebContainer.boot({ coep: 'credentialless', forwardPreviewErrors: true });
  await webContainer.mount(projectFiles(code));
  webContainer.on('server-ready', (port, url) => {
    const frame = byId('sandbox-iframe');
    if (frame) frame.src = url;
    setStatus('WebContainers ready · port ' + port);
  });
  webContainer.on('error', (error) => appendOutput('[WebContainer] ' + (error?.message || String(error)) + '\n'));
  setStatus('Installing project dependencies…');
  const install = await webContainer.spawn('npm', ['install']);
  await pipeProcessOutput(install);
  const installExit = await install.exit;
  if (installExit !== 0) throw new Error('npm install exited with code ' + installExit + '.');
  setStatus('Starting development server…');
  webServerProcess = await webContainer.spawn('npm', ['run', 'dev']);
  pipeProcessOutput(webServerProcess).catch((error) => appendOutput(String(error) + '\n'));
}

async function runE2B() {
  const code = byId('sandbox-code-editor')?.value || '';
  if (!code.trim()) throw new Error('Enter some code before running it.');
  const language = byId('sandbox-language')?.value || 'javascript';
  if (language !== 'javascript' && language !== 'python') throw new Error('Choose JavaScript or Python for E2B execution.');
  setStatus('Connecting to E2B microVM…');
  clearOutput();
  if (!e2bSandboxId) {
    const created = await api('/api/sandboxes/e2b/create', { method: 'POST', body: '{}' });
    e2bSandboxId = created.sandboxId;
  }
  setStatus('Running in isolated E2B microVM · ' + e2bSandboxId.slice(0, 8));
  const result = await api('/api/sandboxes/e2b/execute', {
    method: 'POST',
    body: JSON.stringify({ sandboxId: e2bSandboxId, language, code })
  });
  appendOutput(result.stdout || '');
  if (result.stderr) appendOutput('\n[stderr]\n' + result.stderr);
  appendOutput('\n[exit code: ' + result.exitCode + ']\n');
  setStatus(result.exitCode === 0 ? 'E2B execution complete' : 'E2B execution finished with errors', result.exitCode !== 0);
}

async function runE2BCommand() {
  const command = byId('sandbox-command')?.value.trim();
  if (!command) return;
  if (!e2bSandboxId) {
    const created = await api('/api/sandboxes/e2b/create', { method: 'POST', body: '{}' });
    e2bSandboxId = created.sandboxId;
  }
  setStatus('Running terminal command in E2B…');
  const result = await api('/api/sandboxes/e2b/command', {
    method: 'POST',
    body: JSON.stringify({ sandboxId: e2bSandboxId, command })
  });
  appendOutput((result.stdout || '') + (result.stderr ? '\n' + result.stderr : '') + '\n[exit code: ' + result.exitCode + ']\n');
  byId('sandbox-command').value = '';
  setStatus('E2B terminal ready');
}

async function stopE2B() {
  if (!e2bSandboxId) return setStatus('No active E2B sandbox.');
  const id = e2bSandboxId;
  e2bSandboxId = null;
  await api('/api/sandboxes/e2b/' + encodeURIComponent(id), { method: 'DELETE' });
  setStatus('E2B sandbox stopped.');
}

window.runCodeSandbox = (encodedCode) => {
  let code = encodedCode || '';
  try { code = decodeURIComponent(code); } catch {}
  const modal = byId('sandbox-modal');
  if (modal) modal.classList.remove('hidden');
  const editor = byId('sandbox-code-editor');
  if (editor) editor.value = code;
  setStatus('Code loaded · choose WebContainers or E2B');
};

document.addEventListener('DOMContentLoaded', () => {
  byId('sandbox-run-web')?.addEventListener('click', async () => {
    try { await runWebContainer(); }
    catch (error) { setStatus(error.message || 'WebContainers failed to start.', true); appendOutput('[error] ' + (error.message || error) + '\n'); }
  });
  byId('sandbox-run-e2b')?.addEventListener('click', async () => {
    try { await runE2B(); }
    catch (error) { setStatus(error.message || 'E2B execution failed.', true); appendOutput('[error] ' + (error.message || error) + '\n'); }
  });
  byId('sandbox-run-command')?.addEventListener('click', async () => {
    try { await runE2BCommand(); }
    catch (error) { setStatus(error.message || 'Terminal command failed.', true); appendOutput('[error] ' + (error.message || error) + '\n'); }
  });
  byId('sandbox-command')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); byId('sandbox-run-command')?.click(); }
  });
  byId('sandbox-stop-e2b')?.addEventListener('click', async () => {
    try { await stopE2B(); }
    catch (error) { setStatus(error.message || 'Could not stop E2B.', true); }
  });
});
