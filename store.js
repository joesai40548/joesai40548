import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';

const STORAGE_KEY = 'joes-ai-ui-state';

// Keep transient browser objects (File instances and message payloads) out of
// localStorage. Only harmless display preferences are persisted between visits.
export const appStore = createStore(persist((set) => ({
  theme: 'cream',
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  isOnline: true,
  isSending: false,
  isLoadingSession: false,
  sessions: [],
  currentSessionId: null,
  activeFilename: null,
  chatHistory: [],
  attachmentName: null,

  setOnline: (isOnline) => set({ isOnline }),
  setSending: (isSending) => set({ isSending }),
  setLoadingSession: (isLoadingSession) => set({ isLoadingSession }),
  setSessions: (sessions) => set({ sessions: Array.isArray(sessions) ? sessions : [] }),
  setActiveSession: (currentSessionId, activeFilename) => set({ currentSessionId, activeFilename }),
  setChatHistory: (chatHistory) => set({ chatHistory: Array.isArray(chatHistory) ? [...chatHistory] : [] }),
  setAttachmentName: (attachmentName) => set({ attachmentName }),
  setSidebarMobileOpen: (sidebarMobileOpen) => set({ sidebarMobileOpen }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'cream' : 'light' })),
  resetConversation: () => set({ currentSessionId: null, activeFilename: null, chatHistory: [], attachmentName: null }),
}), {
  name: STORAGE_KEY,
  version: 1,
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({ theme: state.theme, sidebarCollapsed: state.sidebarCollapsed }),
}));
