'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useAnalystChat } from '@/hooks/useAnalystChat';
import { ChatMessage } from '@/components/analyst/ChatMessage';
import { ChatEmptyState } from '@/components/analyst/ChatEmptyState';
import { ThinkingIndicator } from '@/components/analyst/ThinkingIndicator';
import { Composer } from '@/components/analyst/Composer';
import { Button } from '@/components/ui/Button';

/** One readable column; the answer is the hero. Composer sticks to the bottom. */
export function AnalystChat({ firstHorseName }: { firstHorseName?: string }) {
  const { t } = useTranslation();
  const { messages, status, send, retry } = useAnalystChat();
  const endRef = useRef<HTMLDivElement>(null);

  const horse = firstHorseName ?? t('analystPage.exampleHorseFallback');
  const examples = [
    t('analystPage.example1').replace('{horse}', horse),
    t('analystPage.example2').replace('{horse}', horse),
    t('analystPage.example3'),
  ];

  // Keep the newest turn in view; respect reduced-motion and jsdom (no scrollIntoView).
  useEffect(() => {
    const el = endRef.current;
    if (typeof el?.scrollIntoView !== 'function') return;
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [messages, status]);

  const isEmpty = messages.length === 0;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-13rem)] max-w-3xl flex-col">
      {isEmpty ? (
        <ChatEmptyState
          title={t('analystPage.emptyTitle')}
          description={t('analystPage.emptyDescription')}
          examples={examples}
          onPick={send}
        />
      ) : (
        <div
          role="log"
          aria-live="polite"
          aria-label={t('analystPage.conversationAria')}
          className="flex-1 space-y-4 py-2"
        >
          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              role={m.role}
              content={m.content}
              youLabel={t('analystPage.youLabel')}
              analystLabel={t('analystPage.analystLabel')}
            />
          ))}

          {status === 'sending' ? <ThinkingIndicator label={t('analystPage.thinking')} /> : null}

          {status === 'error' ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
              <span className="text-[14px] text-text-secondary">{t('analystPage.error')}</span>
              <Button variant="secondary" size="sm" onClick={retry}>
                {t('common.tryAgain')}
              </Button>
            </div>
          ) : null}

          <div ref={endRef} />
        </div>
      )}

      <div
        className="sticky bottom-0 z-10 bg-app pt-3"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <Composer
          disabled={status === 'sending'}
          placeholder={t('analystPage.inputPlaceholder')}
          sendAria={t('analystPage.sendAria')}
          onSend={send}
        />
        <p className="mt-2 px-1 text-center text-[12px] text-text-tertiary">
          {t('analystPage.disclaimer')}
        </p>
      </div>
    </div>
  );
}
