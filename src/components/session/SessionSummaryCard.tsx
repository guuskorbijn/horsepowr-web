import { Sparkles } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import type { SessionSummary } from '@/services/sessionSummary';

export function SessionSummaryCard({ summary }: { summary: SessionSummary }) {
  return (
    <Card>
      <CardHeader
        title="Summary"
        subtitle={
          summary.source === 'ai'
            ? 'AI overview of the recorded numbers'
            : 'Overview of the recorded numbers'
        }
      />
      <CardBody className="space-y-2.5">
        <ul className="space-y-2">
          {summary.lines.map((line, i) => (
            <li key={i} className="flex gap-2 text-[14px] text-text-primary">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-primary" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-line pt-2.5 text-[12px] text-text-tertiary">
          Descriptive only — measured facts, no assessment of health or performance.
        </p>
      </CardBody>
    </Card>
  );
}
