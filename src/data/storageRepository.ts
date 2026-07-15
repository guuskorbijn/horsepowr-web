import type { Supa } from '@/lib/supabase/types';
import { RepositoryError } from '@/data/errors';

/**
 * Storage repository — the ONLY place Supabase Storage is touched from the web
 * client (mirrors the repository-pattern rule for the database). Backed by the
 * org-scoped `org-media` bucket (20260715000001_storage_org_media.sql).
 *
 * Object paths always start with the org id, which the bucket's RLS write
 * policies key off:
 *   <org_id>/logo/logo               — the stable logo
 *   <org_id>/horses/<horse_id>/photo — a horse photo
 *
 * The bucket is public-read, so we return a stable public URL that renders
 * directly (same contract photo_url already had), with a cache-busting query so
 * a replaced image is not served stale from the CDN.
 */

export const ORG_MEDIA_BUCKET = 'org-media';

function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5 && fromName !== file.name.toLowerCase()) {
    return fromName;
  }
  const fromType = file.type.split('/').pop()?.toLowerCase();
  if (fromType) return fromType === 'jpeg' ? 'jpg' : fromType;
  return 'jpg';
}

async function uploadImage(supa: Supa, path: string, file: File): Promise<string> {
  const { error } = await supa.storage
    .from(ORG_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true });
  if (error) {
    throw new RepositoryError(`uploadImage: ${error.message}`);
  }
  const { data } = supa.storage.from(ORG_MEDIA_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Uploads a stable logo for an org. Returns the public URL for organizations.logo_url. */
export async function uploadOrgLogo(
  supa: Supa,
  orgId: string,
  file: File,
): Promise<string> {
  return uploadImage(supa, `${orgId}/logo/logo.${extensionFor(file)}`, file);
}

/** Uploads a horse photo. Returns the public URL for horses.photo_url. */
export async function uploadHorsePhoto(
  supa: Supa,
  orgId: string,
  horseId: string,
  file: File,
): Promise<string> {
  return uploadImage(supa, `${orgId}/horses/${horseId}/photo.${extensionFor(file)}`, file);
}
