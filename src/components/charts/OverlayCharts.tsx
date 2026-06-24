'use client';

import { useMemo, useState } from 'react';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { xDomainOf, type Domain } from '@/services/chartMath';
import type { ChartSeries } from '@/types/view';

interface Panel {
  title: string;
  unit: string;
  series: ChartSeries[];
  format: (v: number) => string;
}

export function OverlayCharts({
  hr,
  speed,
  altitude,
  legend,
}: {
  hr: ChartSeries[];
  speed: ChartSeries[];
  altitude: ChartSeries[];
  legend: Array<{ label: string; color: string }>;
}) {
  const panels = useMemo<Panel[]>(() => {
    const out: Panel[] = [];
    if (hr.length > 0) out.push({ title: 'Heart rate', unit: 'bpm', series: hr, format: (v) => `${Math.round(v)}` });
    if (speed.length > 0) out.push({ title: 'Speed', unit: 'km/h', series: speed, format: (v) => v.toFixed(1) });
    if (altitude.length > 0) out.push({ title: 'Altitude', unit: 'm', series: altitude, format: (v) => `${Math.round(v)}` });
    return out;
  }, [hr, speed, altitude]);

  const fullDomain = useMemo<Domain>(
    () => xDomainOf([...hr, ...speed, ...altitude]),
    [hr, speed, altitude],
  );
  const [xWindow, setXWindow] = useState<Domain>(fullDomain);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const isZoomed = xWindow[0] !== fullDomain[0] || xWindow[1] !== fullDomain[1];

  if (panels.length === 0) {
    return (
      <Card>
        <CardHeader title="Overlay" />
        <CardBody>
          <p className="text-[14px] text-text-secondary">
            The selected sessions have no comparable HR or GPS traces.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Overlay"
        subtitle="Aligned on elapsed time. Scroll to zoom, drag to pan, double-click to reset."
        action={
          isZoomed ? (
            <Button variant="ghost" size="sm" onClick={() => setXWindow(fullDomain)}>
              Reset zoom
            </Button>
          ) : undefined
        }
      />
      <CardBody className="space-y-5">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
        {panels.map((panel) => (
          <div key={panel.title}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-text-primary">{panel.title}</span>
              <span className="text-[12px] text-text-tertiary">{panel.unit}</span>
            </div>
            <TimeSeriesChart
              series={panel.series}
              xWindow={xWindow}
              fullDomain={fullDomain}
              onWindowChange={setXWindow}
              hoverT={hoverT}
              onHover={setHoverT}
              valueFormat={panel.format}
              ariaLabel={`${panel.title} comparison`}
            />
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
