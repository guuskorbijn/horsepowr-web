'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Watch } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/FormControls';
import { useTranslation } from '@/i18n/LocaleProvider';
import { formatDateTime, formatDurationShort } from '@/services/format';
import { log } from '@/lib/log';
import type { PolarInboxItem } from '@/data/polarRepository';

/**
 * Rides that arrived through the Polar link and still need a horse.
 *
 * A Polar account belongs to a rider, so the horse is SUGGESTED (from the
 * rider's agenda at that time) and confirmed by a person — never filed
 * silently onto a guessed horse.
 */
export function PolarInbox({
  items,
  horses,
  people,
}: {
  items: readonly PolarInboxItem[];
  horses: ReadonlyArray<{ id: string; name: string }>;
  people: ReadonlyArray<{ id: string; label: string }>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.suggested_horse_id ?? ''])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(id: string, body: Record<string, unknown>): Promise<void> {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch('/api/import/polar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inboxId: id, ...body }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      router.refresh();
    } catch (err) {
      log.error('polar inbox: action failed', { error: err instanceof Error ? err.message : String(err) });
      setError(t('polar.inbox.error'));
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) return null;
  const personName = (id: string): string => people.find((p) => p.id === id)?.label ?? '—';

  return (
    <Card className="mb-6">
      <CardHeader title={t('polar.inbox.title')} subtitle={t('polar.inbox.subtitle')} />
      <CardBody className="space-y-2">
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              <Watch size={16} className="text-text-tertiary" />
              <div className="min-w-[14rem] flex-1">
                <p className="text-[14px] font-medium tabular-nums text-text-primary">
                  {formatDateTime(item.started_at)}
                  {item.duration_sec !== null ? ` · ${formatDurationShort(item.duration_sec * 1000)}` : ''}
                </p>
                <p className="text-[12px] text-text-secondary">
                  {personName(item.user_id)}
                  {item.has_hr ? '' : ` · ${t('polar.inbox.noHr')}`}
                  {item.suggested_horse_id !== null ? ` · ${t('polar.inbox.suggested')}` : ''}
                </p>
              </div>
              <Select
                aria-label={t('polar.inbox.horse')}
                className="w-48"
                value={choice[item.id] ?? ''}
                onChange={(e) => setChoice((c) => ({ ...c, [item.id]: e.target.value }))}
              >
                <option value="">{t('polar.inbox.pickHorse')}</option>
                {horses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                disabled={busy !== null || (choice[item.id] ?? '') === ''}
                onClick={() => void send(item.id, { horseId: choice[item.id] })}
              >
                {busy === item.id ? t('common.saving') : t('polar.inbox.import')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => void send(item.id, { dismiss: true })}
              >
                {t('polar.inbox.dismiss')}
              </Button>
            </li>
          ))}
        </ul>
        {error !== null ? <p role="alert" className="text-[13px] text-danger">{error}</p> : null}
        <p className="text-[12px] text-text-tertiary">
          {t('polar.inbox.footer')} <Link className="underline" href="/settings">{t('nav.settings')}</Link>
        </p>
      </CardBody>
    </Card>
  );
}
