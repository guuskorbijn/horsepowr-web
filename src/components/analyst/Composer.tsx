'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const MAX_HEIGHT = 200;

/**
 * Input row: an auto-growing textarea + a primary send button.
 * Enter sends · Shift+Enter is a newline · disabled while a reply is loading.
 * Refocuses itself after each answer so the user can keep typing.
 */
export function Composer({
  disabled,
  placeholder,
  sendAria,
  onSend,
}: {
  disabled: boolean;
  placeholder: string;
  sendAria: string;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const wasDisabled = useRef(disabled);

  // Grow with content, capped; then the textarea scrolls internally.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  // Return focus to the input when a send completes (disabled true -> false).
  useEffect(() => {
    if (wasDisabled.current && !disabled) ref.current?.focus();
    wasDisabled.current = disabled;
  }, [disabled]);

  const submit = (): void => {
    const trimmed = text.trim();
    if (trimmed === '' || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2 rounded-lg border border-line bg-surface p-2 shadow-[var(--shadow-card)] transition-colors focus-within:border-primary">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-[1.5] text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />
      <Button
        variant="primary"
        onClick={submit}
        disabled={disabled || text.trim() === ''}
        aria-label={sendAria}
        className="h-[44px] w-[44px] shrink-0 px-0"
      >
        <Send size={18} aria-hidden />
      </Button>
    </div>
  );
}
