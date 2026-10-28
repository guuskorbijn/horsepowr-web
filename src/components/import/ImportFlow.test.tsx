// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImportFlow } from '@/components/import/ImportFlow';
import type { ImportPreview } from '@/services/import/importService';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const preview: ImportPreview = {
  format: 'tcx',
  startedAt: '2026-10-25T07:00:00.000Z',
  endedAt: '2026-10-25T08:10:00.000Z',
  durationSec: 4200,
  distanceM: 12_400,
  avgHr: 152,
  peakHr: 201,
  peakSpeedKmh: 38.2,
  hrSampleCount: 4150,
  gpsSampleCount: 4200,
  rrIntervalCount: 0,
  qualityGrade: 'good',
  hrGapCount: 1,
  largestHrGapSec: 30,
  sport: 'Other',
  warnings: [{ code: 'hr-gaps', count: 1, seconds: 30 }],
};

function json(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

describe('ImportFlow', () => {
  it('previews first, writes nothing until a horse is chosen and the trainer confirms', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ fileName: 'ride.tcx', fileSha256: 'abc', preview }))
      .mockResolvedValueOnce(json({ outcome: 'already-imported', sessionId: 's-1', rowCount: 8350 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ImportFlow horses={[{ id: 'horse-1', name: 'Luna', maxHr: 220 }]} />);
    const file = new File(['<TrainingCenterDatabase/>'], 'ride.tcx', { type: 'application/xml' });
    fireEvent.change(screen.getByLabelText('Activity file'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('Check before importing')).toBeDefined());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/import/preview');
    expect(screen.getByText(/Heart rate has 1 gaps longer than 10 s/)).toBeDefined();

    const confirm = screen.getByRole('button', { name: 'Import session' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Horse'), { target: { value: 'horse-1' } });
    // With a horse known, HR is shown with its Z label.
    expect(screen.getByText('152 bpm · Z2')).toBeDefined(); // 152/220 = 69%
    fireEvent.click(confirm);

    await waitFor(() => expect(screen.getByText(/Already imported/)).toBeDefined());
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/import/commit');
    const body = fetchMock.mock.calls[1]?.[1]?.body as FormData;
    expect(body.get('expectedSha256')).toBe('abc');
    expect(body.get('horseId')).toBe('horse-1');
  });

  it('shows the server’s refusal as translated copy, never raw file content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'unsafe-xml' }, 422)));
    render(<ImportFlow horses={[]} />);
    const file = new File(['x'], 'evil.tcx');
    fireEvent.change(screen.getByLabelText('Activity file'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not accepted for safety reasons/));
  });
});
