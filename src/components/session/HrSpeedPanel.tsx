import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { HrSpeedChart } from '@/components/charts/HrSpeedChart';
import type { HrSpeedAnalysis } from '@/services/hrSpeedService';

/**
 * HR–speed panel: the scatter + fitted line, and the V-index values read off the
 * fit as plain measured speeds. "speed at HR 200: 31.2 km/h" — descriptive, never
 * a fitness grade. "Not reached" when the session never touched that HR.
 */
export function HrSpeedPanel({
  analysis,
  maxHr,
}: {
  analysis: HrSpeedAnalysis;
  maxHr: number;
}) {
  const hasData = analysis.points.length > 0;

  return (
    <Card>
      <CardHeader
        title="Heart rate vs speed"
        subtitle="Measured HR against speed, with a fitted line. V-index = the speed at which the fit reaches that heart rate."
      />
      <CardBody className="space-y-4">
        <HrSpeedChart analysis={analysis} maxHr={maxHr} />

        {hasData ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {analysis.vIndices.map((v) => (
              <div key={v.hr} className="rounded-md border border-line bg-surface-sunken px-4 py-3">
                <div className="text-[12px] text-text-tertiary">Speed at HR {v.hr}</div>
                <div className="tabular mt-0.5 font-display text-[22px] font-semibold leading-7 text-text-primary">
                  {v.reached && v.speedKmh !== null ? (
                    <>
                      {v.speedKmh.toFixed(1)}
                      <span className="ml-1 text-[13px] font-normal text-text-tertiary">km/h</span>
                    </>
                  ) : (
                    <span className="text-[15px] font-normal text-text-secondary">not reached</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <p className="text-[12px] text-text-tertiary">
          Method: each speed sample is paired with the nearest heart-rate sample, then a
          least-squares line is fit over the locomotion range. V-values are reported only
          within the session&rsquo;s observed HR range — analyst-validated, not extrapolated.
        </p>
      </CardBody>
    </Card>
  );
}
