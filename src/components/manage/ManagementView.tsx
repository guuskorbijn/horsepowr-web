'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Pencil, Plus, ShieldCheck, UserCog } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { HorseAvatar } from '@/components/horse/HorseAvatar';
import { HorseFormDialog } from '@/components/manage/HorseFormDialog';
import { LocationFormDialog } from '@/components/manage/LocationFormDialog';
import { StableLogoCard } from '@/components/manage/StableLogoCard';
import { useTranslation } from '@/i18n/LocaleProvider';
import { cn } from '@/lib/cn';
import type { HorseRow, LocationRow, UserRole } from '@/types/db';

type Tab = 'horses' | 'locations' | 'team';

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [...list, item];
  const copy = list.slice();
  copy[idx] = item;
  return copy;
}

export function ManagementView({
  orgId,
  orgLogoUrl,
  initialHorses,
  initialLocations,
  canManage,
  currentUser,
}: {
  orgId: string;
  orgLogoUrl: string | null;
  initialHorses: HorseRow[];
  initialLocations: LocationRow[];
  canManage: boolean;
  currentUser: { name: string; email: string; role: UserRole };
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('horses');
  const [horses, setHorses] = useState(initialHorses);
  const [locations, setLocations] = useState(initialLocations);

  const [horseDialog, setHorseDialog] = useState<{ open: boolean; existing: HorseRow | null }>({
    open: false,
    existing: null,
  });
  const [locationDialog, setLocationDialog] = useState<{
    open: boolean;
    existing: LocationRow | null;
  }>({ open: false, existing: null });

  const locationName = (id: string | null) =>
    locations.find((l) => l.id === id)?.name ?? t('common.unassigned');

  return (
    <div className="space-y-6">
      <StableLogoCard orgId={orgId} canManage={canManage} initialLogoUrl={orgLogoUrl} />

      <div className="flex gap-1 border-b border-line">
        <TabButton active={tab === 'horses'} onClick={() => setTab('horses')} label={t('horses.tabHorses')} />
        <TabButton active={tab === 'locations'} onClick={() => setTab('locations')} label={t('horses.tabLocations')} />
        <TabButton active={tab === 'team'} onClick={() => setTab('team')} label={t('horses.tabTeam')} />
      </div>

      {tab === 'horses' ? (
        <Card>
          <CardHeader
            title={t('horses.tabHorses')}
            subtitle={`${horses.length} ${t(horses.length === 1 ? 'horses.oneHorse' : 'horses.manyHorses')}`}
            action={
              canManage ? (
                <Button size="sm" onClick={() => setHorseDialog({ open: true, existing: null })}>
                  <Plus size={15} /> {t('horses.addHorse')}
                </Button>
              ) : undefined
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {horses.map((horse) => (
                <li key={horse.id} className="flex items-center gap-3 px-5 py-3">
                  <HorseAvatar photoUrl={horse.photo_url} name={horse.name} />
                  <Link href={`/horses/${horse.id}`} className="min-w-0 flex-1 hover:underline">
                    <span className="block truncate font-medium text-text-primary">
                      {horse.name}
                    </span>
                    <span className="block truncate text-[12px] text-text-secondary">
                      {horse.discipline ?? t('horses.noDiscipline')} · {locationName(horse.location_id)}
                    </span>
                  </Link>
                  {!horse.active ? <StatusPill tone="muted">{t('horses.inactive')}</StatusPill> : null}
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHorseDialog({ open: true, existing: horse })}
                    >
                      <Pencil size={14} /> {t('common.edit')}
                    </Button>
                  ) : null}
                </li>
              ))}
              {horses.length === 0 ? (
                <li className="px-5 py-6 text-[14px] text-text-secondary">
                  {t('horses.noHorsesTitle')} {canManage ? t('horses.noHorsesHint') : ''}
                </li>
              ) : null}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {tab === 'locations' ? (
        <Card>
          <CardHeader
            title={t('horses.tabLocations')}
            subtitle={`${locations.length} ${t(locations.length === 1 ? 'horses.oneLocation' : 'horses.manyLocations')}`}
            action={
              canManage ? (
                <Button size="sm" onClick={() => setLocationDialog({ open: true, existing: null })}>
                  <Plus size={15} /> {t('horses.addLocation')}
                </Button>
              ) : undefined
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {locations.map((loc) => (
                <li key={loc.id} className="flex items-center gap-3 px-5 py-3">
                  <MapPin size={18} className="text-text-tertiary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-text-primary">{loc.name}</span>
                    {loc.country ? (
                      <span className="block text-[12px] text-text-secondary">{loc.country}</span>
                    ) : null}
                  </span>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocationDialog({ open: true, existing: loc })}
                    >
                      <Pencil size={14} /> {t('common.edit')}
                    </Button>
                  ) : null}
                </li>
              ))}
              {locations.length === 0 ? (
                <li className="px-5 py-6 text-[14px] text-text-secondary">{t('horses.noLocations')}</li>
              ) : null}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {tab === 'team' ? (
        <Card>
          <CardHeader title={t('horses.teamTitle')} />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border border-line px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                <UserCog size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text-primary">{currentUser.name}</p>
                <p className="truncate text-[12px] text-text-secondary">{currentUser.email}</p>
              </div>
              <StatusPill tone="info" icon={<ShieldCheck size={13} />}>
                {t(`roles.${currentUser.role}`)}
              </StatusPill>
            </div>
            <p className="text-[13px] text-text-secondary">{t('horses.teamNote')}</p>
          </CardBody>
        </Card>
      ) : null}

      {canManage ? (
        <>
          <HorseFormDialog
            open={horseDialog.open}
            onClose={() => setHorseDialog({ open: false, existing: null })}
            orgId={orgId}
            locations={locations}
            existing={horseDialog.existing}
            onSaved={(horse) => setHorses((prev) => upsert(prev, horse))}
          />
          <LocationFormDialog
            open={locationDialog.open}
            onClose={() => setLocationDialog({ open: false, existing: null })}
            orgId={orgId}
            existing={locationDialog.existing}
            onSaved={(loc) => setLocations((prev) => upsert(prev, loc))}
          />
        </>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        '-mb-px border-b-2 px-4 py-2.5 text-[14px] font-medium transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-text-secondary hover:text-text-primary',
      )}
    >
      {label}
    </button>
  );
}
