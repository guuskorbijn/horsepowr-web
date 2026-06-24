'use client';

import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { GaitTrack, GaitLegend } from '@/components/charts/GaitTrack';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { xDomainOf, type Domain } from '@/services/chartMath';
import { zoneValueBands } from '@/services/hrZone';
import { hrZones } from '@/theme/tokens';
import type { ChartSeries, GaitBand } from '@/types/view';

interface PanelDef {
  series: ChartSeries;
  zoneBacked?: boolean;
  format: (v: number) => string;
}

export function SessionCharts({
  hr,
  speed,
  altitude,
  gaitBands,
  maxHr,
}: {
  hr: ChartSeries | null;
  speed: ChartSeries | null;
  altitude: ChartSeries | null;
  gaitBands: GaitBand[];
  maxHr: number;
}) {
  const panels = useMemo<PanelDef[]>(() => {
    const out: PanelDef[] = [];
    if (hr && hr.points.length > 0) {
      out.push({ series: hr, zoneBacked: true, format: (v) => `${Math.round(v)}` });
    }
    if (speed && speed.points.length > 0) {
      out.push({ series: speed, format: (v) => v.toFixed(1) });
    }
    if (altitude && altitude.points.length > 0) {
      out.push({ series: altitude, format: (v) => `${Math.round(v)}` });
    }
    return out;
  }, [hr, speed, altitude]);

  const fullDomain = useMemo<Domain>(
    () => xDomainOf(panels.map((p) => p.series)),
    [panels],
  );

  const [xWindow, setXWindow] = useState<Domain>(fullDomain);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const [showGaits, setShowGaits] = useState(true);

  const zoneBands = useMemo(() => zoneValueBands(maxHr), [maxHr]);
  const isZoomed = xWindow[0] !== fullDomain[0] || xWindow[1] !== fullDomain[1];

  if (panels.length === 0) {
    return (
      <Card>
        <CardHeader title="Charts" />
        <CardBody>
          <p className="text-[14px] text-text-secondary">
            This session has no heart-rate or GPS samples to chart.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Session charts"
        subtitle="Scroll to zoom, drag to pan, double-click to reset. One shared time axis."
        action={
          <div className="flex items-center gap-2">
            {gaitBands.length > 0 ? (
              <Button
                variant={showGaits ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowGaits((v) => !v)}
                aria-pressed={showGaits}
              >
                <Activity size={15} /> {showGaits ? 'Hide gaits' : 'Show gaits'}
              </Button>
            ) : null}
            {isZoomed ? (
              <Button variant="ghost" size="sm" onClick={() => setXWindow(fullDomain)}>
                Reset zoom
              </Button>
            ) : null}
          </div>
        }
      />
      <CardBody className="space-y-5">
        {panels.map((panel) => (
          <div key={panel.series.key}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-text-primary">
                {panel.series.label}
              </span>
              <span className="text-[12px] text-text-tertiary">{panel.series.unit}</span>
            </div>
            <TimeSeriesChart
              series={[panel.series]}
              xWindow={xWindow}
              fullDomain={fullDomain}
              onWindowChange={setXWindow}
              hoverT={hoverT}
              onHover={setHoverT}
              zoneBands={panel.zoneBacked ? zoneBands : undefined}
              valueFormat={panel.format}
              ariaLabel={`${panel.series.label} over time`}
            />
          </div>
        ))}

        {showGaits && gaitBands.length > 0 ? (
          <div>
            <div className="mb-1 text-[13px] font-medium text-text-primary">Estimated gait</div>
            <GaitTrack bands={gaitBands} xWindow={xWindow} />
            <div className="mt-2">
              <GaitLegend />
            </div>
          </div>
        ) : null}

        {hr && hr.points.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3">
            {(['z1', 'z2', 'z3', 'z4', 'z5'] as const).map((z) => (
              <span
                key={z}
                className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: hrZones[z].color }}
                />
                {z.toUpperCase()} {hrZones[z].label}
              </span>
            ))}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
