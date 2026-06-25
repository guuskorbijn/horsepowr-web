import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { WeeklyVolumeChart } from '@/components/charts/WeeklyVolumeChart';
import { ZONE_LEGEND, weekZoneTotalMin, type WeekVolume } from '@/services/weeklyVolumeService';
import { formatDurationShort } from '@/services/format';

/**
 * Measured weekly volume per horse: total distance, duration, time-in-zone and
 * session count, with stacked Z1–Z5 bars. Measured sums only — explicitly NOT a
 * training-load or readiness signal. Title keeps the framing factual.
 */
export function WeeklyVolumeCard({ weeks }: { weeks: WeekVolume[] }) {
  if (weeks.length === 0) return null;

  const totals = weeks.reduce(
    (acc, w) => ({
      sessions: acc.sessions + w.sessionCount,
      durationMin: acc.durationMin + w.durationMin,
      distanceKm: acc.distanceKm + w.distanceKm,
    }),
    { sessions: 0, durationMin: 0, distanceKm: 0 },
  );

  return (
    <Card>
      <CardHeader
        title="Weekly volume (measured)"
        subtitle="Measured distance, duration and time in each HR zone per week. Sums only — not a training-load score."
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Total label="Sessions" value={`${totals.sessions}`} />
          <Total label="Total time" value={formatDurationShort(totals.durationMin * 60_000)} />
          <Total label="Total distance" value={`${totals.distanceKm.toFixed(1)} km`} />
        </div>

        <WeeklyVolumeChart weeks={weeks} />

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3">
          {ZONE_LEGEND.map((z) => (
            <span key={z.zone} className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: z.color }} />
              {z.zone.toUpperCase()} {z.label}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-text-tertiary">
                <th className="py-2 pr-3 font-medium">Week of</th>
                <th className="py-2 px-3 text-right font-medium">Sessions</th>
                <th className="py-2 px-3 text-right font-medium">Duration</th>
                <th className="py-2 px-3 text-right font-medium">Distance</th>
                <th className="py-2 pl-3 text-right font-medium">Zone minutes</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {[...weeks].reverse().map((w) => (
                <tr key={w.weekStartMs} className="border-b border-line/60 last:border-0">
                  <td className="py-2 pr-3 text-text-secondary">
                    {new Date(w.weekStartMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-2 px-3 text-right text-text-primary">{w.sessionCount}</td>
                  <td className="py-2 px-3 text-right text-text-primary">{formatDurationShort(w.durationMin * 60_000)}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{w.distanceKm.toFixed(1)} km</td>
                  <td className="py-2 pl-3 text-right text-text-secondary">{Math.round(weekZoneTotalMin(w))} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-sunken px-4 py-3">
      <div className="text-[12px] text-text-tertiary">{label}</div>
      <div className="tabular mt-0.5 font-display text-[20px] font-semibold leading-7 text-text-primary">{value}</div>
    </div>
  );
}
