import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders the analyst's reply as SAFE markdown. react-markdown does not render
 * raw HTML by default (no rehype-raw), so the model's text can never inject
 * markup. Every element is mapped to design-system tokens — no `prose` plugin,
 * no invented styles. Numbers use tabular figures so digits don't jitter.
 */
const COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-3 leading-[1.7] last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-[1.6]">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface-muted px-1 py-0.5 text-[13px] tabular-nums">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-md bg-surface-muted p-3 text-[13px] last:mb-0">
      {children}
    </pre>
  ),
  h1: ({ children }) => (
    <h3 className="mb-2 font-display text-[17px] font-medium text-text-primary">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 font-display text-[16px] font-medium text-text-primary">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1.5 font-display text-[15px] font-medium text-text-primary">{children}</h4>
  ),
  hr: () => <hr className="my-3 border-line" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-line-strong pl-3 text-text-secondary">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-[14px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-line px-2.5 py-1.5 text-left font-medium text-text-secondary">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-line px-2.5 py-1.5 tabular-nums">{children}</td>
  ),
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-[15px] text-text-primary">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
