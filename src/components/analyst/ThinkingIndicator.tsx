/**
 * Calm "the analyst is working" indicator — three softly breathing dots on the
 * same card style as an answer. No spinner drama. Motion drops out automatically
 * under prefers-reduced-motion (global rule in globals.css).
 */
export function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 text-text-secondary shadow-[var(--shadow-card)]">
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-tertiary"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
        <span className="text-[14px]">{label}</span>
      </div>
    </div>
  );
}
