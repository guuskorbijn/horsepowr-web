import { NextResponse, type NextRequest } from 'next/server';
import { buildImportPreview } from '@/services/import/importService';
import { readUpload } from '@/services/import/importRequest.server';
import { handleImportFailure, requireImporter } from '@/services/import/importHttp.server';

export const runtime = 'nodejs';

/**
 * POST /api/import/preview — parse an uploaded activity file and describe it.
 * Writes nothing. The response carries the file's hash so the commit can
 * prove it is writing the same file the trainer looked at.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireImporter();
  if (!gate.ok) return gate.response;
  try {
    const upload = await readUpload(await request.formData());
    return NextResponse.json({
      fileName: upload.fileName,
      fileSha256: upload.fileSha256,
      preview: buildImportPreview(upload.activity),
    });
  } catch (err: unknown) {
    return handleImportFailure(err, 'import/preview');
  }
}
