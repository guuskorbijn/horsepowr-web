import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatusPill, type PillTone } from '@/components/ui/StatusPill';
import type { RecordingQuality, QualityGrade } from '@/services/recordingQuality';

const GRADE_LABEL: Record<QualityGrade, string> = {
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  none: 'No data',
};

const GRADE_TONE: Record<QualityGrade, PillTone> = {
  good: 'success',
  fair: 'warning',
  poor: 'warning',
  none: 'muted',
};

export function RecordingQualityCard({ quality }: { quality: RecordingQuality }) {
  return (
    <Card>
      <CardHeader
        title="Recording quality"
        action={
          <StatusPill tone={GRADE_TONE[quality.grade]}>
            {GRADE_LABEL[quality.grade]}
          </StatusPill>
        }
      />
      <CardBody className="space-y-3">
        <p className="text-[14px] text-text-secondary">{quality.explanation}</p>
        {quality.completeness !== null ? (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-muted">
              <div
                className="h-full rounded-pill bg-primary"
                style={{ width: `${Math.round(quality.completeness * 100)}%` }}
              />
            </div>
            <div className="tabular mt-1.5 flex justify-between text-[12px] text-text-tertiary">
              <span>{quality.actualSamples} samples</span>
              <span>{quality.expectedSamples} expected</span>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
