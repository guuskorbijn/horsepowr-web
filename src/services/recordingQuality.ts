/**
 * Recording quality — describes how COMPLETE the HR capture was, not how the
 * horse performed. It compares actual HR samples against the expected count for
 * the session duration (Polar H10 ~1 Hz). Good/Fair/Poor label the *data*, which
 * is a measured fact about the recording, not a judgment of training.
 */
import type { SessionMetrics } from '@/types/view';

export type QualityGrade = 'good' | 'fair' | 'poor' | 'none';

export interface RecordingQuality {
  grade: QualityGrade;
  /** Fraction of expected HR samples actually captured [0..1], or null if N/A. */
  completeness: number | null;
  expectedSamples: number;
  actualSamples: number;
  explanation: string;
}

const SAMPLE_HZ = 1; // Polar H10 streams HR ~once per second

export function assessRecordingQuality(metrics: SessionMetrics): RecordingQuality {
  const expected = Math.round((metrics.durationMs / 1000) * SAMPLE_HZ);
  const actual = metrics.hrSampleCount;

  if (expected <= 0 || actual === 0) {
    return {
      grade: 'none',
      completeness: null,
      expectedSamples: Math.max(0, expected),
      actualSamples: actual,
      explanation: 'No heart-rate samples were recorded for this session.',
    };
  }

  const completeness = Math.min(1, actual / expected);
  const pct = Math.round(completeness * 100);

  let grade: QualityGrade;
  let explanation: string;
  if (completeness >= 0.9) {
    grade = 'good';
    explanation = `${pct}% of expected HR samples captured. Continuous sensor coverage.`;
  } else if (completeness >= 0.7) {
    grade = 'fair';
    explanation = `${pct}% of expected HR samples captured. Some short gaps in sensor coverage.`;
  } else {
    grade = 'poor';
    explanation = `${pct}% of expected HR samples captured. Frequent gaps — the sensor likely dropped out.`;
  }

  return { grade, completeness, expectedSamples: expected, actualSamples: actual, explanation };
}
