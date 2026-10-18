import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { MIN_BEATS_FOR_HRV, type HrvResult } from '@/services/hrv/hrvService';

/**
 * Beat-to-beat variability over the session's calmest stretch.
 *
 * Three deliberate choices.
 *
 * COVERAGE IS SHOWN NEXT TO THE NUMBER, not hidden behind an info icon. A
 * chest strap on a moving horse drops beats, and an rMSSD computed over 58%
 * of a window is a different kind of fact from one computed over 99%. Putting
 * the two side by side is the difference between a figure a vet can argue
 * with and one they have to trust blindly.
 *
 * THE WINDOW IS NAMED. "The calmest three minutes" is a definition, not a
 * physiological resting state, so the panel says when it was taken and lets
 * the reader disagree.
 *
 * NO INTERPRETATION. No baseline, no arrow, no colour. rMSSD in milliseconds
 * is a measured quantity; what it means for this horse on this day is a
 * judgment, and this product does not make those.
 */

function formatMs(value: number | null, digits = 0): string {
  return value === null ? '—' : `${value.toFixed(digits)} ms`;
}

function clockRange(from: string, to: string): string {
  const fmt = (iso: string): string =>
    new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  return `${fmt(from)}–${fmt(to)}`;
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-surface-sunken px-4 py-3">
      <div className="text-[12px] text-text-tertiary">{label}</div>
      <div className="tabular mt-0.5 font-display text-[22px] font-semibold leading-7 text-text-primary">
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[12px] text-text-secondary">{hint}</div> : null}
    </div>
  );
}

export function HrvPanel({ hrv }: { hrv: HrvResult }) {
  const header = (
    <CardHeader
      title="Beat-to-beat variability"
      subtitle="Measured from the RR intervals of the calmest stretch of this session."
    />
  );

  if (hrv.beats === 0) {
    return (
      <Card>
        {header}
        <CardBody>
          <p className="text-[14px] text-text-secondary">
            This session carries no RR intervals, so there is nothing to compute.
            Beat-to-beat data arrives only from the chest strap, and only while it
            is connected.
          </p>
        </CardBody>
      </Card>
    );
  }

  const coveragePct =
    hrv.coverage === null ? null : Math.round(hrv.coverage * 100);
  const meanHr =
    hrv.meanRrMs === null || hrv.meanRrMs <= 0
      ? null
      : Math.round(60_000 / hrv.meanRrMs);

  return (
    <Card>
      {header}
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure
            label="rMSSD"
            value={formatMs(hrv.rmssdMs, 1)}
            hint="Beat-to-beat change"
          />
          <Figure
            label="SDNN"
            value={formatMs(hrv.sdnnMs, 1)}
            hint="Spread over the window"
          />
          <Figure
            label="Mean interval"
            value={formatMs(hrv.meanRrMs)}
            hint={meanHr === null ? undefined : `≈ ${meanHr} bpm`}
          />
        </div>

        {hrv.rmssdMs === null ? (
          <p className="text-[13px] text-text-secondary">
            Fewer than {MIN_BEATS_FOR_HRV} usable beats survived filtering, so no
            variability figure is reported. A number over this few beats would not
            support the comparison it invites.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-[12px] text-text-secondary">
          <span>
            <span className="text-text-tertiary">Window: </span>
            {hrv.window ? clockRange(hrv.window.from, hrv.window.to) : '—'}
          </span>
          <span>
            <span className="text-text-tertiary">Usable beats: </span>
            {hrv.beats}
          </span>
          <span>
            <span className="text-text-tertiary">Coverage: </span>
            {coveragePct === null ? '—' : `${coveragePct}%`}
          </span>
        </div>

        {coveragePct !== null && coveragePct < 80 ? (
          <p className="rounded-md bg-[var(--pill-warning-bg)] px-3 py-2 text-[13px] text-[var(--pill-warning-text)]">
            {100 - coveragePct}% of the intervals in this window were rejected as
            artefacts. Movement noise and dropped beats do that, and the figures
            above are computed over what was left.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
