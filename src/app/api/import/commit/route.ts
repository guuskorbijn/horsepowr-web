import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { commitImport, parseAnnotations } from '@/services/import/importCommit';
import { formText, readUpload } from '@/services/import/importRequest.server';
import { handleImportFailure, importErrorResponse, requireImporter } from '@/services/import/importHttp.server';

export const runtime = 'nodejs';

/**
 * POST /api/import/commit — write a previewed import, after the trainer
 * confirmed it. The file is sent again (nothing is held server-side between
 * the two calls) and must hash to what the preview showed.
 *
 * RLS-scoped anon client only: the database's own trainer-only policies are
 * the gate; the role check in `requireImporter` only spares a doomed request.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireImporter();
  if (!gate.ok) return gate.response;
  try {
    const form = await request.formData();
    const horseId = formText(form, 'horseId');
    const expectedSha256 = formText(form, 'expectedSha256');
    if (horseId === null || horseId.trim() === '') return importErrorResponse('horse-not-found');

    const upload = await readUpload(form);
    if (expectedSha256 !== upload.fileSha256) return importErrorResponse('content-mismatch');

    const result = await commitImport(await getServerSupabase(), {
      orgId: gate.ctx.org.id,
      horseId,
      activity: upload.activity,
      fileSha256: upload.fileSha256,
      annotations: parseAnnotations({
        trainingType: formText(form, 'trainingType'),
        environment: formText(form, 'environment'),
        locationName: formText(form, 'locationName'),
      }),
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return handleImportFailure(err, 'import/commit');
  }
}
