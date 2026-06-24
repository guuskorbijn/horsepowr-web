import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import type { ZoneShare } from '@/services/hrZone';

export function ZoneDistribution({ zones }: { zones: ZoneShare[] }) {
  const total = zones.reduce((acc, z) => acc + z.count, 0);
  if (total === 0) {
    return (
      <Card>
        <CardHeader title="Time in HR zones" />
        <CardBody>
          <p className="text-[14px] text-text-secondary">No heart-rate samples to break down.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Time in HR zones" subtitle="Share of heart-rate samples per zone." />
      <CardBody className="space-y-3">
        <div className="flex h-3 w-full overflow-hidden rounded-pill">
          {zones.map((z) =>
            z.fraction > 0 ? (
              <div
                key={z.zone}
                style={{ width: `${z.fraction * 100}%`, background: z.color }}
                title={`${z.zone.toUpperCase()} ${z.label}: ${Math.round(z.fraction * 100)}%`}
              />
            ) : null,
          )}
        </div>
        <ul className="space-y-1.5">
          {zones.map((z) => (
            <li key={z.zone} className="flex items-center gap-2 text-[13px]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: z.color }}
              />
              <span className="text-text-secondary">
                {z.zone.toUpperCase()} {z.label}
              </span>
              <span className="tabular ml-auto font-medium text-text-primary">
                {Math.round(z.fraction * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
