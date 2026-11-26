'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2, RefreshCw } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { invokePolar, type PolarStatus } from '@/data/polarRepository';
import { useTranslation } from '@/i18n/LocaleProvider';
import { formatDateTime } from '@/services/format';
import { log } from '@/lib/log';

/**
 * The automatic link with a rider's own Polar account.
 *
 * Honest about its state: until Polar has approved the HorsePowr client the
 * card says so and offers the file import instead — the button does not
 * pretend. Linking is per PERSON (a Polar account is a rider's), so this is
 * a personal setting, not a stable setting.
 */
export function PolarConnectionCard({ canImport }: { canImport: boolean }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PolarStatus | null>(null);
  const [busy, setBusy] = useState<null | 'authorize' | 'sync' | 'disconnect'>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchStatus = useCallback(async (): Promise<PolarStatus> => {
    try {
      const result = await invokePolar(getBrowserSupabase(), 'status');
      return { configured: result.configured === true, connection: result.connection ?? null };
    } catch (err) {
      log.error('polar: status failed', { error: err instanceof Error ? err.message : String(err) });
      return { configured: false, connection: null };
    }
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setStatus(await fetchStatus());
  }, [fetchStatus]);

  useEffect(() => {
    let alive = true;
    void fetchStatus().then((next) => {
      if (alive) setStatus(next);
    });
    return () => {
      alive = false;
    };
  }, [fetchStatus]);

  async function run(action: 'authorize' | 'sync' | 'disconnect'): Promise<void> {
    setBusy(action);
    setMessage(null);
    try {
      const result = await invokePolar(getBrowserSupabase(), action);
      if (action === 'authorize' && result.url) {
        window.location.assign(result.url);
        return;
      }
      if (action === 'sync') {
        setMessage(t('polar.synced').replace('{count}', String(result.fetched ?? 0)));
      }
      await load();
    } catch (err) {
      log.error('polar: action failed', { action, error: err instanceof Error ? err.message : String(err) });
      setMessage(t('polar.error'));
    } finally {
      setBusy(null);
    }
  }

  const connection = status?.connection ?? null;

  return (
    <Card>
      <CardHeader title={t('polar.title')} subtitle={t('polar.subtitle')} />
      <CardBody className="space-y-3 text-[14px]">
        {status === null ? (
          <p className="text-text-secondary">{t('common.loading')}</p>
        ) : !status.configured ? (
          <div className="space-y-1 rounded-md bg-surface-muted px-3 py-2">
            <p className="font-medium text-text-primary">{t('polar.pendingTitle')}</p>
            <p className="text-text-secondary">{t('polar.pendingBody')}</p>
          </div>
        ) : connection === null ? (
          <p className="text-text-secondary">{t('polar.notConnected')}</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-text-secondary">{t('polar.statusLabel')}</dt>
            <dd className="text-text-primary">{t(`polar.status.${connection.status}`)}</dd>
            <dt className="text-text-secondary">{t('polar.lastSynced')}</dt>
            <dd className="tabular-nums text-text-primary">
              {connection.lastSyncedAt === null ? '—' : formatDateTime(connection.lastSyncedAt)}
            </dd>
          </dl>
        )}

        <p className="text-[12px] text-text-tertiary">{t('polar.scopeNote')}</p>

        {status?.configured && canImport ? (
          <div className="flex flex-wrap gap-2">
            {connection === null ? (
              <Button size="sm" onClick={() => void run('authorize')} disabled={busy !== null}>
                <Link2 size={14} /> {t('polar.connect')}
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={() => void run('sync')} disabled={busy !== null}>
                  <RefreshCw size={14} /> {busy === 'sync' ? t('polar.syncing') : t('polar.syncNow')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void run('disconnect')} disabled={busy !== null}>
                  {t('polar.disconnect')}
                </Button>
              </>
            )}
          </div>
        ) : null}
        {message !== null ? <p role="status" className="text-[13px] text-text-secondary">{message}</p> : null}
      </CardBody>
    </Card>
  );
}
