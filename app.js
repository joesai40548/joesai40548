/* ========== Joes AI — Application Logic ========== */

import { escapeHtml } from './utils.js';
import { API_BASE_URL } from './api-config.js';
import { authenticatedFetch } from './auth-client.js';

const BACKEND_URL = API_BASE_URL;

window.tailwind = window.tailwind || {};
window.tailwind.config = window.tailwind.config || {};

// ---------- Toast notification system (replaces alert()) ----------
const toastContainer = (() => {
  let el = document.getElementById('toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
})();

window.showToast = function (message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="flex-1 text-sm">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;
  toastContainer.appendChild(toast);
  if (duration > 0) {
    setTimeout(() => { toast.remove(); }, duration);
  }
  return toast;
};

// ---------- Offline / online detection ----------
let isOnline = navigator.onLine;
function updateOnlineStatus() {
  const wasOnline = isOnline;
  isOnline = navigator.onLine;
  if (!wasOnline && isOnline) {
    showToast('You are back online.', 'success');
    fetchSessions();
  } else if (wasOnline && !isOnline) {
    showToast('You appear to be offline. Some features may not work.', 'error');
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ---------- Fetch with exponential-backoff retry ----------
async function retryFetch(url, options = {}, { retries = 3, baseDelay = 800 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      if (!navigator.onLine) {throw new Error('You appear to be offline.');}
      const res = await fetch(url, options);
      if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
      return res;
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

// ---------- Read a response body as text (supports streaming chunks) ----------
async function readStreamText(response, onChunk) {
  if (!response.body) {
    const text = await response.text();
    if (onChunk) {onChunk(text, text);}
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) {break;}
    const chunk = decoder.decode(value, { stream: true });
    result += chunk;
    if (onChunk) {onChunk(chunk, result);}
  }
  return result;
}

// ---------- Page loader ----------
function hidePageLoader() {
  const loader = document.getElementById('page-loader');
  if (!loader) {return;}
  loader.style.opacity = '0';
  setTimeout(() => { if (loader) {loader.style.display = 'none';} }, 400);
}
window.addEventListener('load', hidePageLoader);
window.addEventListener('DOMContentLoaded', hidePageLoader);

// ---------- Cursor mouse glow tracker ----------
document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth) * 100;
  const y = (e.clientY / window.innerHeight) * 100;
  document.body.style.setProperty('--mouse-x', `${x}%`);
  document.body.style.setProperty('--mouse-y', `${y}%`);
});

// ---------- User identity ----------
const userId = localStorage.getItem('joes_ai_user_id') || 'user_' + Math.random().toString(36).substring(2, 11);
localStorage.setItem('joes_ai_user_id', userId);

let sessions = [];
let currentSessionId = null;
let activeFilename = null;
let chatHistory = [];
let selectedAttachment = null;

// ---------- DOM refs ----------
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const sendIcon = document.getElementById('send-icon');
const chatMessages = document.getElementById('chat-messages');
const chatModeSelect = document.getElementById('chat-mode-select');
const micBtn = document.getElementById('mic-btn');
const sessionList = document.getElementById('session-list');
const newChatBtn = document.getElementById('new-chat-btn');

const sidebar = document.getElementById('sidebar');
const sidebarOpenBtn = document.getElementById('sidebar-open-btn');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');

const themeBtn = document.getElementById('theme-btn');
const exportBtn = document.getElementById('export-btn');

const sandboxModal = document.getElementById('sandbox-modal');
const sandboxIframe = document.getElementById('sandbox-iframe');
const sandboxCloseBtn = document.getElementById('sandbox-close-btn');

// ---------- Event delegation for message actions ----------
if (chatMessages) {
  chatMessages.addEventListener('click', (e) => {
    const ttsBtn = e.target.closest('.tts-trigger');
    const copyBtn = e.target.closest('.copy-trigger');
    const runBtn = e.target.closest('.run-trigger');

    if (ttsBtn) {
      const rawContent = ttsBtn.getAttribute('data-content');
      window.speakText(ttsBtn, rawContent);
    }
    if (copyBtn) {
      const code = copyBtn.getAttribute('data-code');
      window.copyToClipboard(copyBtn, code);
    }
    if (runBtn) {
      const code = runBtn.getAttribute('data-code');
      if (typeof window.runCodeSandbox === 'function') window.runCodeSandbox(code);
      else showToast('Sandbox runtime is unavailable. Reload the page and try again.', 'error');
    }
  });
}

// ---------- Input auto-resize ----------
if (messageInput) {
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = `${messageInput.scrollHeight}px`;
  });
}

// ---------- Mobile sidebar ----------
function hideSidebarOnMobile() {
  if (window.innerWidth <= 768 && sidebar) {
    sidebar.classList.add('sidebar-mobile-hidden');
  }
}

// ---------- Welcome / empty state ----------
function showWelcome(show) {
  const emptyState = document.getElementById('empty-state');
  if (show && emptyState) {
    emptyState.style.display = 'flex';
  } else if (emptyState) {
    emptyState.style.display = 'none';
  }
}

// ---------- File reader ----------
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- TTS ----------
window.speakText = (btn, text) => {
  window.speechSynthesis.cancel();

  if (btn.dataset.speaking === 'true') {
    btn.textContent = '🔊 Read';
    btn.classList.remove('text-[#ef4444]');
    btn.dataset.speaking = 'false';
    return;
  }

  document.querySelectorAll('.tts-trigger').forEach((b) => {
    b.textContent = '🔊 Read';
    b.classList.remove('text-[#ef4444]');
    b.dataset.speaking = 'false';
  });

  const decoded = decodeURIComponent(text);
  let cleanTextString = decoded
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/```[\s\S]*?```/g, '[Code Block]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .trim();

  if (!cleanTextString) {
    showToast('No readable content.', 'error');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanTextString);
  const loadedVoices = window.speechSynthesis.getVoices();
  if (loadedVoices.length > 0) {
    const preferredVoice =
      loadedVoices.find((v) => v.lang.startsWith('en') && v.name.includes('Google')) ||
      loadedVoices.find((v) => v.lang.startsWith('en')) ||
      loadedVoices[0];
    utterance.voice = preferredVoice;
  }

  utterance.onend = () => {
    btn.textContent = '🔊 Read';
    btn.classList.remove('text-[#ef4444]');
    btn.dataset.speaking = 'false';
  };
  utterance.onerror = () => {
    btn.textContent = '🔊 Read';
    btn.classList.remove('text-[#ef4444]');
    btn.dataset.speaking = 'false';
  };

  btn.textContent = '🛑 Stop';
  btn.classList.add('text-[#ef4444]');
  btn.dataset.speaking = 'true';

  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 100);
};

// ---------- Code sandbox ----------
// The authenticated sandbox runtime is implemented in sandbox-runtime.js.

// ---------- Sidebar handlers ----------
function setupSidebarHandlers() {
  if (sidebarOpenBtn && sidebar) {
    sidebarOpenBtn.addEventListener('click', () => {
      sidebar.classList.remove('sidebar-mobile-hidden');
    });
  }
  if (sidebarCloseBtn && sidebar) {
    sidebarCloseBtn.addEventListener('click', () => {
      sidebar.classList.add('sidebar-mobile-hidden');
    });
  }
  if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
      sidebarToggleBtn.textContent = isCollapsed ? '⟩' : '⟨';
      localStorage.setItem('joes_ai_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    });
  }

  if (localStorage.getItem('joes_ai_sidebar_collapsed') === 'true' && sidebar) {
    sidebar.classList.add('sidebar-collapsed');
    if (sidebarToggleBtn) {sidebarToggleBtn.textContent = '⟩';}
  }
}

// ---------- Theme ----------
function setupThemeHandler() {
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('light');
      const lightActive = document.body.classList.contains('light');
      themeBtn.innerHTML = lightActive ? '☀️' : '🌙';
      localStorage.setItem('joes_ai_theme', lightActive ? 'light' : 'cream');
    });

    if (localStorage.getItem('joes_ai_theme') === 'light') {
      document.body.classList.add('light');
      themeBtn.innerHTML = '☀️';
    } else {
      document.body.classList.remove('light');
      themeBtn.innerHTML = '🌙';
    }
  }
}

// ---------- Copy to clipboard ----------
window.copyToClipboard = (btn, encodedText) => {
  const text = decodeURIComponent(encodedText);
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    })
    .catch((err) => {
      console.error('Could not copy text: ', err);
      showToast('Failed to copy to clipboard.', 'error');
    });
};

// ---------- Export ----------
function setupExportHandler() {
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (chatHistory.length === 0) {
        showToast('No chat history to export yet!', 'info');
        return;
      }

      let mdString = `# Joes AI Conversation History\n*Date: ${new Date().toLocaleDateString()}*\n\n---\n\n`;
      chatHistory.forEach((msg) => {
        const author = msg.role === 'user' ? 'User' : 'Joes AI';
        mdString += `### **${author}**:\n${msg.content}\n\n---\n\n`;
      });

      const blob = new Blob([mdString], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.setAttribute('download', `JoesAI_ChatExport_${Date.now()}.md`);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    });
  }
}

// ---------- Core event listeners ----------
function setupEventListeners() {
  if (sendBtn) {sendBtn.addEventListener('click', handleSend);}
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  const attachBtn = document.getElementById('attachment-btn');
  const fileInput = document.getElementById('file-input');
  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
  }

  const clearBtn = document.getElementById('clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      startNewChat();
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener('click', startNewChat);
  }
}

// ---------- Speech recognition ----------
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition && micBtn) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      micBtn.innerHTML = '🔴';
      micBtn.classList.add('animate-pulse', 'bg-red-500/30');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (messageInput) {
        messageInput.value = (messageInput.value + ' ' + transcript).trim();
        messageInput.focus();
        messageInput.dispatchEvent(new Event('input'));
      }
    };

    recognition.onerror = () => {
      micBtn.innerHTML = '🎤';
      micBtn.classList.remove('animate-pulse', 'bg-red-500/30');
    };

    recognition.onend = () => {
      micBtn.innerHTML = '🎤';
      micBtn.classList.remove('animate-pulse', 'bg-red-500/30');
    };

    micBtn.addEventListener('click', () => {
      recognition.start();
    });
  } else if (micBtn) {
    micBtn.style.display = 'none';
  }
}

// ---------- Sessions ----------
async function fetchSessions() {
  if (!sessionList) {return;}
  sessionList.innerHTML = '<p class="text-xs text-[#8e8e8e] italic px-2">Syncing with Koofr...</p>';
  try {
    const response = await retryFetch(`${BACKEND_URL}/api/chats`, {
      headers: { 'x-user-id': userId },
    });
    sessions = await response.json();
    renderSessions();
  } catch (err) {
    console.error(err);
    sessionList.innerHTML = '<p class="text-xs text-[#ef4444] italic px-2">Koofr offline</p>';
    showToast('Unable to load recent chats.', 'error');
  }
}

function startNewChat() {
  currentSessionId = null;
  activeFilename = null;
  chatHistory = [];
  if (chatMessages) {chatMessages.innerHTML = '';}
  renderSessions();
  showWelcome(true);
  hideSidebarOnMobile();
}

window.loadSession = async (filename) => {
  showLoadingIndicator(true);
  try {
    const response = await fetch(`${BACKEND_URL}/api/chats/${filename}`, {
      headers: { 'x-user-id': userId },
    });
    if (!response.ok) {throw new Error('Could not retrieve file.');}
    const data = await response.json();

    currentSessionId = data.sessionId;
    activeFilename = filename;
    chatHistory = data.history || [];
    if (chatMessages) {chatMessages.innerHTML = '';}

    if (chatHistory.length === 0) {
      showWelcome(true);
    } else {
      showWelcome(false);
      chatHistory.forEach((msg) => {
        addMessageToUI(msg.role, msg.content, msg.attachment);
      });
    }
    renderSessions();
    hideSidebarOnMobile();
  } catch (err) {
    showToast(`Error loading chat: ${err.message}`, 'error');
  } finally {
    showLoadingIndicator(false);
  }
};

window.deleteSession = async (filename) => {
  if (!confirm('Are you sure you want to permanently delete this chat from your Koofr cloud?')) {return;}

  try {
    const response = await fetch(`${BACKEND_URL}/api/chats/${filename}`, {
      method: 'DELETE',
      headers: { 'x-user-id': userId },
    });
    if (!response.ok) {throw new Error('Cloud rejected deletion.');}

    if (activeFilename === filename) {
      startNewChat();
    }
    fetchSessions();
  } catch (err) {
    showToast(`Deletion failed: ${err.message}`, 'error');
  }
};

window.renameSession = async (filename, id, oldTitle) => {
  const renamedInput = prompt('Enter new conversation title:', oldTitle);
  if (!renamedInput || renamedInput.trim() === '' || renamedInput === oldTitle) {return;}

  try {
    const response = await fetch(`${BACKEND_URL}/api/chats/rename`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({
        oldFilename: filename,
        sessionId: id,
        newTitle: renamedInput.trim(),
      }),
    });

    if (!response.ok) {throw new Error('Koofr failed to rename file.');}
    const data = await response.json();

    if (activeFilename === filename) {
      activeFilename = data.filename;
    }
    await fetchSessions();
  } catch (err) {
    showToast(`Rename Failed: ${err.message}`, 'error');
  }
};

function renderSessions() {
  if (!sessionList) {return;}
  sessionList.innerHTML = '';
  if (sessions.length === 0) {
    sessionList.innerHTML = '<p class="text-xs text-[#8e8e8e] italic px-2">No recent chats</p>';
    return;
  }

  sessions.forEach((sess) => {
    const isActive = sess.filename === activeFilename;
    const item = document.createElement('div');
    item.className = `group flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all ${isActive ? 'bg-[#1f1f1f] text-white border-l-2 border-[#10a37f]' : 'text-[#8e8e8e] hover:bg-[#1f1f1f] hover:text-white'}`;
    item.innerHTML = `
      <span class="truncate flex-1 pr-2">💬 ${escapeHtml(sess.title)}</span>
      <div class="flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button class="text-[#8e8e8e] hover:text-[#10a37f] p-0.5 rename-btn" title="Rename thread">✏️</button>
        <button class="text-[#8e8e8e] hover:text-[#ef4444] p-0.5 delete-btn" title="Delete thread">✕</button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      const renameTarget = e.target.closest('.rename-btn');
      const deleteTarget = e.target.closest('.delete-btn');

      if (renameTarget) {
        window.renameSession(sess.filename, sess.id, sess.title);
      } else if (deleteTarget) {
        window.deleteSession(sess.filename);
      } else {
        window.loadSession(sess.filename);
      }
    });
    sessionList.appendChild(item);
  });
}

async function saveCurrentChatToCloud(title) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({
        sessionId: currentSessionId,
        title: title,
        history: chatHistory,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      activeFilename = data.filename;
    }
  } catch (err) {
    console.warn('Koofr autocommit issue:', err.message);
  }
}

// ---------- File select ----------
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) {return;}

  if (file.size > 5 * 1024 * 1024) {
    showToast('File size exceeds 5MB limit. Large files may crash the tab.', 'error');
    return;
  }

  selectedAttachment = file;
  showAttachmentChip(file);
}

function showAttachmentChip(file) {
  const container = document.getElementById('attachment-chip-container');
  if (!container) {return;}
  let previewHtml = '';

  if (file.type.startsWith('image/')) {
    const imgUrl = URL.createObjectURL(file);
    previewHtml = `<img src="${imgUrl}" class="w-8 h-8 rounded-lg object-cover border border-[#272727]/40 shadow-md">`;
  }

  container.innerHTML = `
    <div class="bg-[#1f1f1f] backdrop-blur-md border border-[#10a37f]/30 text-white pl-2 pr-4 py-1.5 rounded-2xl text-xs flex items-center space-x-2 ">
      ${previewHtml}
      <span class="font-medium truncate max-w-[200px] text-white">📎 ${escapeHtml(file.name)}</span>
      <button onclick="window.removeAttachment()" class="hover:text-[#10a37f] transition-colors font-bold ml-2">✕</button>
    </div>
  `;
  container.classList.remove('hidden');
}

window.removeAttachment = () => {
  selectedAttachment = null;
  const fileInput = document.getElementById('file-input');
  if (fileInput) {fileInput.value = '';}
  const container = document.getElementById('attachment-chip-container');
  if (container) {container.classList.add('hidden');}
};

window.useQuickPrompt = (promptText, preferredMode) => {
  if (messageInput && chatModeSelect) {
    messageInput.value = promptText;
    if (preferredMode) {
      chatModeSelect.value = preferredMode;
    }
    messageInput.focus();
    messageInput.dispatchEvent(new Event('input'));
  }
};

// ---------- Input state ----------
function toggleInputState(disabled) {
  if (!messageInput || !sendBtn) {return;}
  messageInput.disabled = disabled;
  sendBtn.disabled = disabled;

  const attachBtn = document.getElementById('attachment-btn');
  if (attachBtn) {attachBtn.disabled = disabled;}
  if (micBtn) {micBtn.disabled = disabled;}

  if (disabled) {
    messageInput.classList.add('opacity-50');
    sendIcon.innerHTML = `
      <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    `;
  } else {
    messageInput.classList.remove('opacity-50');
    sendIcon.innerHTML = `
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
    `;
  }
}

// ---------- Send message ----------
async function handleSend() {
  if (!messageInput || !chatModeSelect) {return;}
  const message = messageInput.value.trim();
  const hasAttachment = !!selectedAttachment;
  const currentMode = chatModeSelect.value;

  if (!message && !hasAttachment) {return;}

  messageInput.value = '';
  messageInput.style.height = 'auto';
  messageInput.blur();
  toggleInputState(true);

  let activeTitle = '';
  if (!currentSessionId) {
    currentSessionId = 'session_' + Date.now();
    const firstTopic = message || (selectedAttachment ? `Attached: ${selectedAttachment.name}` : 'New Conversation');
    activeTitle = firstTopic.length > 22 ? firstTopic.substring(0, 22) + '...' : firstTopic;
  } else {
    const activeSess = sessions.find((s) => s.filename === activeFilename);
    activeTitle = activeSess ? activeSess.title : 'Saved Chat';
  }

  let attachmentPayload = null;
  let base64AttachmentData = null;
  let currentMimeType = null;

  if (hasAttachment) {
    base64AttachmentData = await readFileAsBase64(selectedAttachment);
    currentMimeType = selectedAttachment.type || 'application/octet-stream';

    attachmentPayload = {
      name: selectedAttachment.name,
      type: currentMimeType,
      base64: selectedAttachment.type.startsWith('image/') ? `data:${currentMimeType};base64,${base64AttachmentData}` : null,
    };
  }

  const cloudAttachmentPayload = hasAttachment ? { name: selectedAttachment.name, type: currentMimeType } : null;

  addMessageToUI('user', message, attachmentPayload);
  chatHistory.push({ role: 'user', content: message, attachment: cloudAttachmentPayload });

  await saveCurrentChatToCloud(activeTitle);

  window.removeAttachment();
  showWelcome(false);
  showProcessingIndicator();

  // Optimistic UI: render an assistant placeholder bubble immediately so the
  // user sees a response container appear without waiting for the round-trip.
  let streamingBubble = null;
  if (chatMessages) {
    streamingBubble = document.createElement('div');
    streamingBubble.className = 'msg-wrapper assistant';
    streamingBubble.innerHTML = `
      <div class="msg-bubble assistant overflow-x-auto relative">
        <div class="flex items-center gap-2" style="min-height:1.2rem;">
          <span class="text-xs text-[#10a37f] italic">Joes AI is responding</span>
          <span class="animate-pulse text-[#10a37f]">●</span>
        </div>
      </div>
    `;
    chatMessages.appendChild(streamingBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  try {
    let aiText = '';

    if (hasAttachment) {
      const response = await retryFetch(`${BACKEND_URL}/api/gemini`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          message,
          fileData: base64AttachmentData,
          mimeType: currentMimeType,
          mode: currentMode,
          chatHistory: chatHistory.slice(0, -1).map((h) => ({ role: h.role, content: h.content })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {throw new Error(data.error || 'Server error');}
      aiText = data.text;
    } else {
      // Normal chat is agent-backed. Authenticate with Firebase and keep one
      // stable LangGraph thread for the active conversation.
      if (!currentSessionId) currentSessionId = (globalThis.crypto?.randomUUID?.() || ('chat_' + Date.now() + '_' + Math.random().toString(36).slice(2)));
      // retryFetch preserves the existing retry policy; authenticatedFetch adds
      // the Firebase bearer token required by the protected agent chat route.
      const authenticatedResponse = await authenticatedFetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: message }],
          mode: currentMode,
          sessionId: currentSessionId,
        }),
      });
      if (!authenticatedResponse.ok) {
        const errorData = await authenticatedResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Agent chat failed (${authenticatedResponse.status}).`);
      }
      const data = await authenticatedResponse.json();
      aiText = typeof data.text === 'string' ? data.text : '';
      if (!aiText) throw new Error('The agent returned an empty response.');
      if (data.agent?.automatic) {
        const used = [
          ...(data.agent.usedMcpTools || []),
          ...(data.agent.usedSearch ? ['web_search'] : [])
        ];
        if (used.length) console.info('[JOES AI agent]', { executionId: data.agent.executionId, tools: used });
      }
    }

    removeProcessingIndicator();
    // Replace the streaming placeholder with the final formatted assistant message.
    if (streamingBubble) {streamingBubble.remove();}
    addMessageToUI('assistant', aiText);
    chatHistory.push({ role: 'assistant', content: aiText });

    await saveCurrentChatToCloud(activeTitle);
    await fetchSessions();
  } catch (err) {
    removeProcessingIndicator();
    if (streamingBubble) {streamingBubble.remove();}
    addMessageToUI('assistant', `⚠️ **Error:** ${escapeHtml(err.message)}`);
  } finally {
    toggleInputState(false);
  }
}

// ---------- Message rendering ----------
function addMessageToUI(role, content, attachmentData = null) {
  if (!chatMessages) {return;}
  const wrapper = document.createElement('div');
  wrapper.className = `msg-wrapper ${role === 'user' ? 'user' : 'assistant'}`;

  const innerClass = role === 'user'
    ? 'msg-bubble user'
    : 'msg-bubble assistant';

  let attachmentHtml = '';
  if (attachmentData) {
    if (attachmentData.base64) {
      attachmentHtml = `<img src="${attachmentData.base64}" referrerpolicy="no-referrer" class="attachment-img">`;
    } else {
      attachmentHtml = `
        <div class="attachment-file">
          <span class="text-xl">📄</span>
          <div class="truncate flex-1">
            <p class="font-medium text-white truncate">${escapeHtml(attachmentData.name)}</p>
            <p class="text-[#8e8e8e] text-[10px] uppercase tracking-wide">${(attachmentData.type.split('/')[1] || 'File').toUpperCase()}</p>
          </div>
        </div>
      `;
    }
  }

  const encodedString = encodeURIComponent(content || '');
  const speakerBadge = role === 'assistant'
    ? `<div class="msg-actions"><button class="text-[#8e8e8e] hover:text-[#10a37f] text-xs p-1 tracking-wide tts-trigger" data-content="${encodedString}" aria-label="Read message aloud">🔊 Read</button></div>`
    : '';

  wrapper.innerHTML = `<div class="${innerClass} overflow-x-auto">${attachmentHtml}${formatMarkdown(content)}${speakerBadge}</div>`;
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (window.mermaid) {
    setTimeout(() => {
      window.mermaid.run({ querySelector: '.mermaid' }).catch((err) => {});
    }, 50);
  }
}

function showProcessingIndicator() {
  if (!chatMessages) {return;}
  const div = document.createElement('div');
  div.id = 'processing-indicator';
  div.className = 'processing-indicator';
  div.innerHTML = `
    <div class="processing-bubble">
      <span id="processing-text" class="processing-text">Joes AI is thinking</span>
      <div class="processing-dots">
        <span class="snake-dot"></span>
        <span class="snake-dot"></span>
        <span class="snake-dot"></span>
        <span class="snake-dot"></span>
      </div>
    </div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const thinkingStages = [
    'Joes AI is thinking',
    'Joes AI is processing',
    'Joes AI is finalizing',
    'Joes AI is wrapping up',
  ];
  let stageCounter = 0;
  const targetTextSpan = div.querySelector('#processing-text');

  const textStageInterval = setInterval(() => {
    stageCounter++;
    if (stageCounter < thinkingStages.length) {
      if (targetTextSpan) {targetTextSpan.textContent = thinkingStages[stageCounter];}
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
      clearInterval(textStageInterval);
    }
  }, 1800);

  div.dataset.intervalId = textStageInterval;
}

function removeProcessingIndicator() {
  const indicatorEl = document.getElementById('processing-indicator');
  if (indicatorEl) {
    if (indicatorEl.dataset.intervalId) {
      clearInterval(parseInt(indicatorEl.dataset.intervalId, 10));
    }
    indicatorEl.remove();
  }
}

function showLoadingIndicator(show) {
  if (show && chatMessages) {
    chatMessages.innerHTML = `
      <div class="loading-state">
        <div class="loader-spinner"></div>
        <span class="text-xs text-[#8e8e8e]">Loading conversation from Koofr...</span>
      </div>
    `;
  }
}

// ---------- Markdown formatter ----------
function formatMarkdown(text) {
  if (!text) {return '';}

  const temporaryCodeVault = [];

  let escaped = text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Extract code blocks first
  escaped = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const token = `__CODE_TOKEN_REPLACEMENT_${temporaryCodeVault.length}__`;
    temporaryCodeVault.push({ lang, code });
    return token;
  });

  // Images
  escaped = escaped.replace(/!\[([^\]]*)\]\(([^)]+?)(?:\s+"[^"]*")?\)/g, (match, alt, src) => {
    return `___IMG_START___${src.trim()}___ALT___${alt || 'Image'}___IMG_END___`;
  });

  escaped = escaped.replace(/___IMG_START___(.*?)___ALT___(.*?)___IMG_END___/g, (match, src, alt) => {
    const html = `
      <div class="image-card my-4 overflow-hidden rounded-xl border shadow-xl max-w-full bg-[#171717]/80 border-[#272727]/40 shadow-md">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" referrerpolicy="no-referrer" loading="lazy" class="w-full h-auto object-contain max-h-[380px]" onerror="this.onerror=null; this.closest('.image-card').remove();">
        <p class="p-2 text-center text-xs border-t bg-[#1f1f1f]\/90 text-[#8e8e8e] border-[#272727]">${escapeHtml(alt)}</p>
      </div>
    `;
    return html.replace(/\n/g, ' ');
  });

  // Tables
  const lines = escaped.split('\n');
  let insideTable = false;
  let generatedTableBuffer = '';
  const compiledLines = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (rawLine.startsWith('|') && rawLine.endsWith('|')) {
      if (/^[|:\-\s]+$/.test(rawLine)) {
        insideTable = true;
        continue;
      }
      const columnValues = rawLine.split('|').slice(1, -1).map((v) => v.trim());
      if (!insideTable) {
        insideTable = true;
        generatedTableBuffer = `
          <div class="overflow-x-auto my-4 border rounded-xl max-w-full bg-[#171717]/80 border-[#272727]/40 shadow-md">
            <table class="min-w-full divide-y divide-[#272727] text-sm text-left">
              <thead class="bg-[#1f1f1f] text-[#10a37f] text-xs font-semibold uppercase tracking-wider">
                <tr>
        `;
        columnValues.forEach((columnTitle) => {
          generatedTableBuffer += `<th class="px-4 py-3">${escapeHtml(columnTitle)}</th>`;
        });
        generatedTableBuffer += `
                </tr>
              </thead>
              <tbody class="divide-y divide-[#272727]">
        `;
      } else {
        generatedTableBuffer += '<tr class="hover:bg-[#1f1f1f]/50 transition-colors">';
        columnValues.forEach((cellValue) => {
          generatedTableBuffer += `<td class="px-4 py-3 text-white">${escapeHtml(cellValue)}</td>`;
        });
        generatedTableBuffer += '</tr>';
      }
    } else {
      if (insideTable) {
        generatedTableBuffer += '</tbody></table></div>';
        compiledLines.push(generatedTableBuffer.replace(/\n/g, ' '));
        generatedTableBuffer = '';
        insideTable = false;
      }
      compiledLines.push(lines[i]);
    }
  }
  if (insideTable) {
    generatedTableBuffer += '</tbody></table></div>';
    compiledLines.push(generatedTableBuffer.replace(/\n/g, ' '));
  }

  escaped = compiledLines.join('\n');

  // Links
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    return `
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-[#10a37f] hover:text-[#10a37f] font-semibold underline decoration-[#10a37f]\/40 hover:decoration-[#10a37f] transition-all inline-flex items-center gap-1">
        ${escapeHtml(linkText)}
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
      </a>
    `.replace(/\n/g, ' ');
  });

  // Headings
  escaped = escaped.replace(/^#{1,6}\s+(.*)$/gm, (match, headingText) => {
    const level = (match.match(/^#+/) || [''])[0].length;
    const levelClamped = Math.min(Math.max(level, 1), 6);
    return `<h${levelClamped} class="text-white font-bold mb-1 mt-2 text-lg leading-tight">${escapeHtml(headingText.trim())}</h${levelClamped}>`;
  });

  // Inline code & bold
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="bg-[#1f1f1f]/20 text-[#10a37f] px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#10a37f]">$1</strong>')
    .replace(/^\s*[-*+]\s+(.*)$/gm, '<li class="list-disc ml-4 my-1 text-[#a1a1a1]">$1</li>');

  escaped = escaped.replace(/\n/g, '<br>');

  // Restore code blocks
  temporaryCodeVault.forEach((block, idx) => {
    const token = `__CODE_TOKEN_REPLACEMENT_${idx}__`;
    const displayLang = block.lang ? block.lang.toUpperCase() : 'CODE';
    const encoded = encodeURIComponent(block.code.trim());

    let finalOutput = '';
    if (block.lang && block.lang.toLowerCase() === 'mermaid') {
      finalOutput = `<div class="mermaid my-4 p-4 bg-[#1f1f1f] border border-[#272727] rounded-xl text-center overflow-x-auto">${block.code.trim()}</div>`;
    } else {
      const isRunnable = ['HTML', 'XML', 'JS', 'JAVASCRIPT', 'CSS'].includes(displayLang);
      finalOutput = `
        <div class="code-block relative group my-3 border border-[#272727] rounded-xl overflow-hidden bg-[#1f1f1f] text-left">
          <div class="flex justify-between items-center px-4 py-1.5 bg-[#1f1f1f] border-b border-[#272727] text-[10px] text-[#8e8e8e] tracking-wider">
            <span>${escapeHtml(displayLang)}</span>
            <div class="flex items-center">
              <button class="text-[#8e8e8e] hover:text-[#10a37f] transition-colors copy-trigger" data-code="${encoded}" aria-label="Copy code">Copy</button>
              ${isRunnable ? `<button class="text-[#8e8e8e] hover:text-[#10a37f] transition-colors ml-2 run-trigger" data-code="${encoded}" aria-label="Run code in sandbox">Run</button>` : ''}
            </div>
          </div>
          <pre class="code-pre p-4 overflow-x-auto text-sm font-mono">${escapeHtml(block.code.trim())}</pre>
        </div>
      `;
    }
    escaped = escaped.replace(token, finalOutput);
  });

  return escaped;
}

// ---------- Tool modals ----------
function setupToolHandlers() {
  const driveModal = document.getElementById('drive-modal');
  const driveCloseBtn = document.getElementById('drive-close-btn');
  const driveFilesList = document.getElementById('drive-files-list');
  const youtubeModal = document.getElementById('youtube-modal');
  const youtubeCloseBtn = document.getElementById('youtube-close-btn');
  const youtubeSearchInput = document.getElementById('youtube-search-input');
  const youtubeSearchSubmit = document.getElementById('youtube-search-submit');
  const youtubeResultsList = document.getElementById('youtube-results-list');

  if (driveCloseBtn) {driveCloseBtn.addEventListener('click', () => {
    if (driveModal) {driveModal.classList.add('hidden');}
  });}
  if (youtubeCloseBtn) {youtubeCloseBtn.addEventListener('click', () => {
    if (youtubeModal) {youtubeModal.classList.add('hidden');}
    if (youtubeResultsList) {youtubeResultsList.innerHTML = '<p class="text-center text-[#8e8e8e] py-8">Search results will appear here.</p>';}
  });}

  function renderYouTubeResults(videos) {
    if (!videos.length) {
      return '<p class="text-center text-[#8e8e8e]">No videos found.</p>';
    }
    return `
      <div class="youtube-grid">
        ${videos.map((v) => `
          <div class="youtube-card">
            <div class="youtube-thumbnail">
              <img src="${escapeHtml(v.thumbnail)}" referrerpolicy="no-referrer" loading="lazy" alt="${escapeHtml(v.title)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='https://placehold.co/320x180?text=No+Thumbnail';">
              <span class="badge">Video</span>
            </div>
            <div class="youtube-info">
              <h4 class="youtube-title" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</h4>
              <p class="youtube-channel">${escapeHtml(v.channelTitle)}</p>
              <p class="youtube-desc">${escapeHtml(v.description || '')}</p>
            </div>
            <div class="youtube-actions">
              <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer" class="youtube-play">▶ Play Video</a>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function updateYouTubeResults(videos) {
    if (youtubeResultsList) {youtubeResultsList.innerHTML = renderYouTubeResults(videos);}
  }

  if (youtubeSearchSubmit) {
    youtubeSearchSubmit.addEventListener('click', async () => {
      const query = youtubeSearchInput.value.trim();
      if (!query) {
        if (youtubeResultsList) {youtubeResultsList.innerHTML = '<p class="text-center text-[#ef4444]">Please enter a search query.</p>';}
        return;
      }
      if (youtubeResultsList) {youtubeResultsList.innerHTML = '<p class="text-center text-[#10a37f] animate-pulse">Searching...</p>';}
      try {
        const response = await fetch(`${BACKEND_URL}/api/youtube/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, maxResults: 6 }),
        });
        if (!response.ok) {throw new Error('Search failed');}
        const data = await response.json();
        const results = data.videos;
        if (!results || !results.length) {
          updateYouTubeResults([]);
        } else {
          updateYouTubeResults(results);
        }
      } catch (err) {
        console.error(err);
        if (youtubeResultsList) {youtubeResultsList.innerHTML = `<p class="text-center text-[#ef4444]">Search failed: ${escapeHtml(err.message)}</p>`;}
      }
    });
  }

  const driveFilesBtn = document.getElementById('drive-files-btn');
  const youtubeSearchBtn = document.getElementById('youtube-search-btn');

  if (driveFilesBtn) {
    driveFilesBtn.addEventListener('click', async () => {
      if (driveModal) {driveModal.classList.remove('hidden');}
      if (driveFilesList) {driveFilesList.innerHTML = '<p class="text-center text-[#8e8e8e] py-8">Loading files...</p>';}
      try {
        const response = await fetch(`${BACKEND_URL}/api/drive/files`);
        if (!response.ok) {throw new Error('Failed to fetch files');}
        const data = await response.json();
        const files = data.files;
        if (!files.length) {
          if (driveFilesList) {driveFilesList.innerHTML = '<p class="text-center text-[#8e8e8e]">No files found.</p>';}
        } else {
          const html = files.map((f) => `
            <div class="drive-item">
              <span class="icon">📄</span>
              <div class="drive-info">
                <p class="drive-name">${escapeHtml(f.name)}</p>
                <p class="drive-type">${escapeHtml(f.mimeType)}</p>
              </div>
            </div>
          `).join('');
          if (driveFilesList) {driveFilesList.innerHTML = html;}
        }
      } catch (err) {
        console.error(err);
        if (driveFilesList) {driveFilesList.innerHTML = `<p class="text-center text-[#ef4444]">Failed to load files: ${escapeHtml(err.message)}</p>`;}
      }
    });
  }

  if (youtubeSearchBtn) {
    youtubeSearchBtn.addEventListener('click', () => {
      if (youtubeModal) {youtubeModal.classList.remove('hidden');}
      if (youtubeSearchInput) {youtubeSearchInput.value = '';}
      if (youtubeResultsList) {youtubeResultsList.innerHTML = '<p class="text-center text-[#8e8e8e] py-8">Enter query to search videos.</p>';}
    });
  }
}

// ---------- Initialize ----------
function initializeApp() {
  setupEventListeners();
  setupSidebarHandlers();
  setupThemeHandler();
  setupExportHandler();
  setupSpeechRecognition();
  setupToolHandlers();

  updateOnlineStatus();

  showWelcome(true);
  fetchSessions();
}

initializeApp();
