'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Client-side state + wiring for the analyst chat. All business logic lives here;
 * components only render. Talks to the existing POST /api/analyst/chat (no backend
 * changes) and sends the FULL messages array each turn so the endpoint's multi-turn
 * loop has the whole conversation.
 */
export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export type ChatStatus = 'idle' | 'sending' | 'error';

interface ChatApiResponse {
  reply?: string;
  error?: string;
}

export interface UseAnalystChat {
  messages: ChatMessage[];
  status: ChatStatus;
  /** Append a user message and request the analyst's reply. No-op while sending. */
  send: (text: string) => void;
  /** Re-run the last request after an error. */
  retry: () => void;
}

export function useAnalystChat(): UseAnalystChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const seq = useRef(0);
  const nextId = useCallback((): string => `m${(seq.current += 1)}`, []);

  const runRequest = useCallback(
    async (conversation: ChatMessage[]): Promise<void> => {
      setStatus('sending');
      try {
        const res = await fetch('/api/analyst/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: conversation.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const data: ChatApiResponse | null = await res.json().catch(() => null);
        if (!res.ok || !data || typeof data.reply !== 'string') {
          throw new Error(data?.error ?? 'request failed');
        }
        const reply = data.reply;
        setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: reply }]);
        setStatus('idle');
      } catch {
        // Keep the conversation (ending in the user turn) so retry can re-send.
        setStatus('error');
      }
    },
    [nextId],
  );

  const send = useCallback(
    (text: string): void => {
      const trimmed = text.trim();
      if (trimmed === '' || status === 'sending') return;
      const next: ChatMessage[] = [...messages, { id: nextId(), role: 'user', content: trimmed }];
      setMessages(next);
      void runRequest(next);
    },
    [messages, status, nextId, runRequest],
  );

  const retry = useCallback((): void => {
    if (status !== 'error') return;
    void runRequest(messages);
  }, [status, messages, runRequest]);

  return { messages, status, send, retry };
}
