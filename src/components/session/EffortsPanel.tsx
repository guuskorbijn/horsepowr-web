import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { formatBpm, formatDurationShort, formatGradient, formatKmhValue } from '@/services/format';
import { formatElapsed } from '@/services/chartMath';
import { workEfforts } from '@/services/effortService';
import type { Effort } from '@/types/view';

function distance(e: Effort): string {
  if (e.distanceM === null) return '—';
  return e.distanceM < 1000 ? `${Math.round(e.distanceM)} m` : `${(e.distanceM / 1000).toFixed(2)} km`;
}

/**
 * Detected work bouts for a session, as a plain table of measured facts. The
 * bands are overlaid on the session charts (toggle there). DESCRIPTIVE only —
 * this reports what was executed, it never grades it against a prescription.
 */
export function EffortsPanel({ efforts, hasGps }: { efforts: Effort[]; hasGps: boolean }) {
  const work = workEfforts(efforts);

  if (work.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Efforts"
          subtitle="Work bouts detected from heart rate (and speed where present)."
        />
        <CardBody>
          <p className="text-[14px] text-text-secondary">
            No distinct work bouts were detected in this session&rsquo;s heart-rate trace.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Efforts"
        subtitle={`${work.length} work ${work.length === 1 ? 'bout' : 'bouts'} detected from HR/speed — analyst-validated method.`}
      />
      <CardBody className="px-0 py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-text-tertiary">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">Start</th>
                <th className="px-3 py-2.5 font-medium">Duration</th>
                <th className="px-3 py-2.5 text-right font-medium">Distance</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg HR</th>
                <th className="px-3 py-2.5 text-right font-medium">Peak HR</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg km/h</th>
                <th className="px-3 py-2.5 text-right font-medium">Max km/h</th>
                {hasGps ? (
                  <th className="px-4 py-2.5 text-right font-medium">
                    Avg grade<span className="text-text-tertiary"> *</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="tabular">
              {work.map((e) => (
                <tr key={e.startTs} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-text-primary">{e.workIndex}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{formatElapsed(e.startTs)}</td>
                  <td className="px-3 py-2.5 text-text-primary">{formatDurationShort(e.durationMs)}</td>
                  <td className="px-3 py-2.5 text-right text-text-secondary">{distance(e)}</td>
                  <td className="px-3 py-2.5 text-right text-text-primary">{formatBpm(e.avgHr)}</td>
                  <td className="px-3 py-2.5 text-right text-text-primary">{formatBpm(e.peakHr)}</td>
                  <td className="px-3 py-2.5 text-right text-text-secondary">{formatKmhValue(e.avgSpeedMs)}</td>
                  <td className="px-3 py-2.5 text-right text-text-secondary">{formatKmhValue(e.maxSpeedMs)}</td>
                  {hasGps ? (
                    <td className="px-4 py-2.5 text-right text-text-secondary">
                      {formatGradient(e.avgGradient)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-[12px] text-text-tertiary">
          Method: bouts detected from measured HR (and speed where present), with
          hysteresis to avoid flicker. Thresholds are analyst-pending.
          {hasGps ? ' * Gradient is an estimate from GPS altitude.' : ''}
        </p>
      </CardBody>
    </Card>
  );
}
