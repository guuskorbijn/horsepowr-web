'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { updateOrgLogo } from '@/data/orgRepository';
import { uploadOrgLogo as uploadLogoFile } from '@/data/storageRepository';
import { useTranslation } from '@/i18n/LocaleProvider';

/**
 * Stable branding — shows the org logo and lets a trainer upload/replace it.
 * The logo also renders at the top of the dashboard (command center); a
 * router.refresh() re-fetches the server-rendered org context after a change.
 */
export function StableLogoCard({
  orgId,
  canManage,
  initialLogoUrl,
}: {
  orgId: string;
  canManage: boolean;
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const supa = getBrowserSupabase();
      const url = await uploadLogoFile(supa, orgId, file);
      const org = await updateOrgLogo(supa, orgId, url);
      setLogoUrl(org.logo_url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('stableLogo.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title={t('stableLogo.title')} subtitle={t('stableLogo.subtitle')} />
      <CardBody>
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-muted">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={t('stableLogo.title')} className="h-full w-full object-contain" />
            ) : (
              <ImagePlus size={22} className="text-text-tertiary" />
            )}
          </span>
          {canManage ? (
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {busy ? t('stableLogo.uploading') : logoUrl ? t('stableLogo.change') : t('stableLogo.upload')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <p className="text-[13px] text-text-secondary">{t('stableLogo.onlyTrainers')}</p>
          )}
        </div>
        {error ? (
          <p className="mt-3 rounded-md bg-[var(--pill-warning-bg)] px-3 py-2 text-[13px] text-[var(--pill-warning-text)]">
            {error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
