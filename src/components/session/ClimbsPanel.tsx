import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { formatBpm, formatGradient, formatKmhValue } from '@/services/format';
import { formatElapsed } from '@/services/chartMath';
import type { ClimbSegment } from '@/services/gradientService';

function distance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

/**
 * Detected uphill segments with the HR/speed measured on them. Gradient and
 * climb metres are ESTIMATES from GPS altitude (noisy) — stated as such, never
 * graded.
 */
export function ClimbsPanel({ climbs }: { climbs: ClimbSegment[] }) {
  if (climbs.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Climbs"
        subtitle="Detected uphill segments — gradient and climb are estimates from GPS altitude."
      />
      <CardBody className="px-0 py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-text-tertiary">
                <th className="px-4 py-2.5 font-medium">Start</th>
                <th className="px-3 py-2.5 text-right font-medium">Distance</th>
                <th className="px-3 py-2.5 text-right font-medium">Climb *</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg gradient *</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg HR</th>
                <th className="px-3 py-2.5 text-right font-medium">Peak HR</th>
                <th className="px-4 py-2.5 text-right font-medium">Max km/h</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {climbs.map((c) => (
                <tr key={c.startTs} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2.5 text-text-secondary">{formatElapsed(c.startTs)}</td>
                  <td className="px-3 py-2.5 text-right text-text-primary">{distance(c.distanceM)}</td>
                  <td className="px-3 py-2.5 text-right text-text-primary">{Math.round(c.climbM)} m</td>
                  <td className="px-3 py-2.5 text-right text-text-secondary">{formatGradient(c.avgGradient)}</td>
                  <td className="px-3 py-2.5 text-right text-text-primary">{formatBpm(c.avgHr)}</td>
                  <td className="px-3 py-2.5 text-right text-text-primary">{formatBpm(c.peakHr)}</td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{formatKmhValue(c.maxSpeedMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-[12px] text-text-tertiary">
          * Gradient and climb are estimates — consumer GPS altitude is noisy, so values are
          smoothed before display.
        </p>
      </CardBody>
    </Card>
  );
}
