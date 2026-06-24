'use client';

import { useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { getMeasurements } from '@/data/measurementRepository';
import { measurementsToCsv } from '@/services/csvExport';
import { downloadTextFile } from '@/lib/download';

export function ExportBar({
  sessionId,
  startedAt,
  slug,
  summaryCsv,
}: {
  sessionId: string;
  startedAt: string;
  slug: string;
  summaryCsv: string;
}) {
  const [busy, setBusy] = useState(false);

  function exportSummary() {
    downloadTextFile(`${slug}-summary.csv`, summaryCsv);
  }

  async function exportMeasurements() {
    setBusy(true);
    try {
      const rows = await getMeasurements(getBrowserSupabase(), sessionId);
      downloadTextFile(`${slug}-measurements.csv`, measurementsToCsv(rows, startedAt));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={exportSummary}>
        <FileText size={15} /> Summary CSV
      </Button>
      <Button variant="secondary" size="sm" onClick={exportMeasurements} disabled={busy}>
        <Download size={15} /> {busy ? 'Preparing…' : 'Measurements CSV'}
      </Button>
      <Button variant="secondary" size="sm" onClick={() => window.print()}>
        <Printer size={15} /> Print / PDF
      </Button>
    </div>
  );
}
