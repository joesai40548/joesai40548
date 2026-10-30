import { MutationObserver, QueryClient } from '@tanstack/query-core';

// Query Core owns server state; Zustand continues to own local UI state.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (Number.isInteger(error?.status) && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  sessions: (userId) => ['chats', 'list', userId],
  session: (userId, filename) => ['chats', 'detail', userId, filename],
};

export async function apiJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = await window.getJoesAiIdToken?.();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  headers.delete('x-user-id');
  const response = await fetch(url, { ...options, headers });
  const responseText = await response.text();
  let payload = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { message: responseText };
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function runMutation(options, variables) {
  const observer = new MutationObserver(queryClient, options);
  return observer.mutate(variables);
}
