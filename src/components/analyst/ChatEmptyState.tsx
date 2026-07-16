import { Sparkles } from 'lucide-react';

/**
 * Inviting empty state (design-system voice: empty states invite action). A short
 * intro plus real, one-click example questions that actually run against the
 * stable's data. Clicking sends the question straight away.
 */
export function ChatEmptyState({
  title,
  description,
  examples,
  onPick,
}: {
  title: string;
  description: string;
  examples: string[];
  onPick: (question: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Sparkles size={22} aria-hidden />
      </div>
      <h2 className="font-display text-[20px] font-medium text-text-primary">{title}</h2>
      <p className="mt-1.5 max-w-md text-[14px] leading-[1.6] text-text-secondary">{description}</p>
      <div className="mt-6 flex w-full max-w-md flex-col gap-2">
        {examples.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onPick(question)}
            className="rounded-lg border border-line bg-surface px-4 py-3 text-left text-[14px] text-text-primary transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
