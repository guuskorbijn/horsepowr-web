import { MarkdownMessage } from '@/components/analyst/MarkdownMessage';
import type { ChatRole } from '@/hooks/useAnalystChat';

/**
 * One turn in the conversation. User right (subtle blue tint), analyst left on a
 * calm card — the answer is the hero. A visually-hidden speaker label keeps the
 * roles clear to screen readers (colour/position alone isn't enough).
 */
export function ChatMessage({
  role,
  content,
  youLabel,
  analystLabel,
}: {
  role: ChatRole;
  content: string;
  youLabel: string;
  analystLabel: string;
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-tr-sm bg-primary-soft px-4 py-2.5 text-[15px] leading-[1.6] text-text-primary">
          <span className="sr-only">{youLabel}: </span>
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="w-full rounded-lg rounded-tl-sm border border-line bg-surface px-5 py-4 shadow-[var(--shadow-card)]">
        <span className="sr-only">{analystLabel}: </span>
        <MarkdownMessage content={content} />
      </div>
    </div>
  );
}
