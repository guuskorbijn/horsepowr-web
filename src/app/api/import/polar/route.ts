import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { sha256Hex } from '@/lib/deterministicId';
import { getInboxRecord, setInboxStatus } from '@/data/polarRepository';
import { commitImport, parseAnnotations } from '@/services/import/importCommit';
import { defaultParserRegistry } from '@/services/import/parserRegistry';
import { normaliseActivity } from '@/services/import/importService';
import { handleImportFailure, importErrorResponse, requireImporter } from '@/services/import/importHttp.server';

export const runtime = 'nodejs';

/**
 * POST /api/import/polar — file a ride that arrived through Polar AccessLink.
 *
 * Body: { inboxId, horseId } to import, or { inboxId, dismiss: true }.
 *
 * The ride's TCX goes through EXACTLY the file-import pipeline (same parser,
 * same normalisation, same idempotent commit), so an API ride and an uploaded
 * file of the same ride cannot disagree about what was measured. RLS on
 * `polar_inbox` and `sessions` is the real gate.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireImporter();
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as { inboxId?: unknown; horseId?: unknown; dismiss?: unknown };
    if (typeof body.inboxId !== 'string') return importErrorResponse('empty');
    const supa = await getServerSupabase();
    const record = await getInboxRecord(supa, body.inboxId);
    if (record === null || record.status !== 'pending') return importErrorResponse('empty');

    if (body.dismiss === true) {
      await setInboxStatus(supa, record.id, 'dismissed', null);
      return NextResponse.json({ outcome: 'dismissed' });
    }
    if (typeof body.horseId !== 'string' || body.horseId === '') {
      return importErrorResponse('horse-not-found');
    }

    const bytes = new TextEncoder().encode(record.tcx);
    const parsed = defaultParserRegistry.parse({ fileName: `polar-${record.polar_exercise_id}.tcx`, bytes });
    const result = await commitImport(supa, {
      orgId: gate.ctx.org.id,
      horseId: body.horseId,
      activity: normaliseActivity(parsed),
      fileSha256: sha256Hex(bytes),
      annotations: parseAnnotations({ trainingType: null, environment: null, locationName: null }),
      polarExerciseId: record.polar_exercise_id,
    });
    await setInboxStatus(supa, record.id, 'imported', result.sessionId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return handleImportFailure(err, 'import/polar');
  }
}
