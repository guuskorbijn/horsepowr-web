import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { RecoveryChart } from '@/components/charts/RecoveryChart';
import { formatDuration } from '@/services/format';
import type { RecoveryDescent } from '@/services/recoveryService';

/**
 * Measured recovery descent after the last detected work bout. States the drop
 * at +1/+5/+10 min as plain facts. NO score, NO Better/Normal badge — that
 * normative reading is the analyst's, by design.
 */
export function RecoveryPanel({ recovery }: { recovery: RecoveryDescent | null }) {
  if (!recovery) {
    return (
      <Card>
        <CardHeader title="Recovery descent" subtitle="Measured HR after the last effort." />
        <CardBody>
          <p className="text-[14px] text-text-secondary">
            No distinct work bout was detected, so there is no post-effort recovery to plot.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Recovery descent"
        subtitle="Measured heart rate after the last detected effort — how far it fell, as a fact."
      />
      <CardBody className="space-y-4">
        <RecoveryChart recovery={recovery} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {recovery.marks.map((m) => (
            <div key={m.atSec} className="rounded-md border border-line bg-surface-sunken px-4 py-3">
              <div className="text-[12px] text-text-tertiary">HR at +{formatDuration(m.atSec * 1000)}</div>
              {m.recorded && m.hr !== null ? (
                <>
                  <div className="tabular mt-0.5 font-display text-[22px] font-semibold leading-7 text-text-primary">
                    {Math.round(m.hr)}
                    <span className="ml-1 text-[13px] font-normal text-text-tertiary">bpm</span>
                  </div>
                  <div className="tabular mt-0.5 text-[13px] text-text-secondary">
                    −{Math.round(m.dropBpm ?? 0)} from peak ({Math.round(m.dropPct ?? 0)}%)
                  </div>
                </>
              ) : (
                <div className="mt-0.5 text-[15px] text-text-secondary">not recorded</div>
              )}
            </div>
          ))}
        </div>

        <p className="text-[12px] text-text-tertiary">
          These are measured drops from the effort&rsquo;s peak HR. Recovery interpretation is the analyst&rsquo;s.
        </p>
      </CardBody>
    </Card>
  );
}
