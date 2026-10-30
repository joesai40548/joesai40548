import { ensureFirebaseSession } from './auth-client.js';
import { API_BASE_URL } from './api-config.js';

const API_BASE = API_BASE_URL;
const byId = (id) => document.getElementById(id);
let webContainer = null;
let e2bSandboxId = null;
let webServerProcess = null;
let monacoEditor = null;
let xterm = null;
let terminalFit = null;
const MONACO_CDN = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs';


function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find((script) => script.src === src);
    if (existing?.dataset.loaded === 'true') return resolve();
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
    script.onerror = () => reject(new Error('Could not load editor/terminal assets from the CDN.'));
    document.head.appendChild(script);
  });
}

async function ensureMonacoEditor() {
  const host = byId('sandbox-monaco-editor');
  const fallback = byId('sandbox-code-editor');
  if (!host || !fallback || monacoEditor) return;
  if (!window.monaco?.editor) {
    await loadScript(MONACO_CDN + '/loader.js');
    window.MonacoEnvironment = {
      getWorkerUrl: () => {
        const base = MONACO_CDN.replace(/\/vs$/, '');
        const worker = "self.MonacoEnvironment = { baseUrl: '" + base + "/' }; importScripts('" + MONACO_CDN + "/base/worker/workerMain.js');";
        return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(worker);
      }
    };
    window.require.config({ paths: { vs: MONACO_CDN } });
    await new Promise((resolve, reject) => window.require(['vs/editor/editor.main'], resolve, reject));
  }
  monacoEditor = window.monaco.editor.create(host, {
    value: fallback.value,
    language: (byId('sandbox-language')?.value || 'javascript') === 'python' ? 'python' : 'javascript',
    theme: 'vs-dark', automaticLayout: true, minimap: { enabled: false },
    fontSize: 13, scrollBeyondLastLine: false, wordWrap: 'on'
  });
  fallback.classList.add('hidden');
  host.classList.remove('hidden');
}

function getEditorValue() {
  return monacoEditor ? monacoEditor.getValue() : (byId('sandbox-code-editor')?.value || '');
}

function setEditorValue(value) {
  const fallback = byId('sandbox-code-editor');
  if (fallback) fallback.value = value;
  if (monacoEditor) monacoEditor.setValue(value);
}

async function ensureXterm() {
  const host = byId('sandbox-terminal');
  const fallback = byId('sandbox-output');
  if (!host || !fallback || xterm) return;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.css';
  document.head.appendChild(stylesheet);
  await loadScript('https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.js');
  await loadScript('https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js');
  if (!window.Terminal || !window.FitAddon?.FitAddon) throw new Error('The terminal library did not initialize.');
  xterm = new window.Terminal({
    convertEol: true, disableStdin: true, cursorBlink: false, scrollback: 3000, fontSize: 12,
    theme: { background: '#09090b', foreground: '#e2e8f0' }
  });
  terminalFit = new window.FitAddon.FitAddon();
  xterm.loadAddon(terminalFit);
  fallback.classList.add('hidden');
  host.classList.remove('hidden');
  xterm.open(host);
  terminalFit.fit();
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => terminalFit?.fit());
    observer.observe(host);
  }
  xterm.write('JOES AI terminal ready\r\n');
}

function setStatus(message, isError = false) {
  const el = byId('sandbox-runtime-status');
  if (el) {
    el.textContent = message;
    el.className = 'text-xs mr-auto ' + (isError ? 'text-rose-300' : 'text-slate-300');
  }
}

function appendOutput(value) {
  const el = byId('sandbox-output');
  const text = String(value ?? '');
  if (xterm) { xterm.write(text.replace(/\r?\n/g, '\r\n')); return; }
  if (!el) return;
  el.textContent = (el.textContent === 'Output will appear here.' ? '' : el.textContent) + text;
  el.scrollTop = el.scrollHeight;
}

function clearOutput() {
  const el = byId('sandbox-output');
  if (el) el.textContent = '';
  if (xterm) xterm.clear();
}

async function api(path, options = {}) {
  const session = await ensureFirebaseSession(API_BASE);
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', 'Bearer ' + session.idToken);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(API_BASE + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Sandbox request failed (' + response.status + ').');
    error.status = response.status;
    throw error;
  }
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
  const code = getEditorValue();
  if (!code.trim()) throw new Error('Enter some code before running it.');
  if ((byId('sandbox-language')?.value || 'javascript') === 'python') throw new Error('WebContainers runs JavaScript/Node.js projects. Choose E2B to run Python.');
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
  const { WebContainer } = await import('https://esm.sh/@webcontainer/api@1.6.4');
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

async function ensureE2BSandbox() {
  if (e2bSandboxId) return e2bSandboxId;
  const created = await api('/api/sandboxes/e2b/create', { method: 'POST', body: '{}' });
  if (!created.sandboxId) throw new Error('The E2B service did not return a sandbox ID.');
  e2bSandboxId = created.sandboxId;
  return e2bSandboxId;
}

async function runE2BRequest(path, payload) {
  await ensureE2BSandbox();
  const send = () => api(path, {
    method: 'POST',
    body: JSON.stringify({ ...payload, sandboxId: e2bSandboxId })
  });
  try {
    return await send();
  } catch (error) {
    if (error.status !== 404) throw error;
    e2bSandboxId = null;
    await ensureE2BSandbox();
    return send();
  }
}

async function runE2B() {
  const code = getEditorValue();
  if (!code.trim()) throw new Error('Enter some code before running it.');
  const language = byId('sandbox-language')?.value || 'javascript';
  if (language !== 'javascript' && language !== 'python') throw new Error('Choose JavaScript or Python for E2B execution.');
  setStatus('Connecting to E2B microVM…');
  clearOutput();
  await ensureE2BSandbox();
  setStatus('Running in isolated E2B microVM · ' + e2bSandboxId.slice(0, 8));
  const result = await runE2BRequest('/api/sandboxes/e2b/execute', { language, code });
  appendOutput(result.stdout || '');
  if (result.stderr) appendOutput('\n[stderr]\n' + result.stderr);
  appendOutput('\n[exit code: ' + result.exitCode + ']\n');
  setStatus(result.exitCode === 0 ? 'E2B execution complete' : 'E2B execution finished with errors', result.exitCode !== 0);
}

async function runE2BCommand() {
  const command = byId('sandbox-command')?.value.trim();
  if (!command) return;
  await ensureE2BSandbox();
  setStatus('Running terminal command in E2B…');
  const result = await runE2BRequest('/api/sandboxes/e2b/command', { command });
  appendOutput((result.stdout || '') + (result.stderr ? '\n' + result.stderr : '') + '\n[exit code: ' + result.exitCode + ']\n');
  byId('sandbox-command').value = '';
  setStatus('E2B terminal ready');
}

async function stopE2B() {
  if (!e2bSandboxId) return setStatus('No active E2B sandbox.');
  const id = e2bSandboxId;
  e2bSandboxId = null;
  try {
    await api('/api/sandboxes/e2b/' + encodeURIComponent(id), { method: 'DELETE' });
    setStatus('E2B sandbox stopped.');
  } catch (error) {
    if (error.status !== 404) throw error;
    setStatus('E2B sandbox had already expired.');
  }
}

window.runCodeSandbox = (encodedCode) => {
  let code = encodedCode || '';
  try { code = decodeURIComponent(code); } catch {}
  const modal = byId('sandbox-modal');
  if (modal) modal.classList.remove('hidden');
  setEditorValue(code);
  ensureMonacoEditor().catch((error) => setStatus(error.message || 'Monaco editor unavailable; using the basic editor.', true));
  ensureXterm().catch((error) => appendOutput('[terminal] ' + (error.message || error) + '\n'));
  setStatus('Code loaded · choose WebContainers or E2B');
};

document.addEventListener('DOMContentLoaded', () => {
  byId('sandbox-language')?.addEventListener('change', (event) => {
    if (monacoEditor && window.monaco?.editor) {
      window.monaco.editor.setModelLanguage(monacoEditor.getModel(), event.target.value === 'python' ? 'python' : 'javascript');
    }
  });
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
