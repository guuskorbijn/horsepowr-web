import { Card, CardBody } from '@/components/ui/Card';
import { formatAge } from '@/services/age';
import { getServerT } from '@/i18n/server';
import type { HorseRow } from '@/types/db';

/** Read-only identity + physical facts for a horse. Descriptive only. */
export async function HorseDetailsCard({ horse }: { horse: HorseRow }) {
  const t = await getServerT();
  const age = formatAge(horse.date_of_birth);
  const items: { label: string; value: string }[] = [];

  if (horse.discipline) items.push({ label: t('horses.detail.discipline'), value: horse.discipline });
  if (horse.sex) items.push({ label: t('horses.detail.sex'), value: t(`horses.sex.${horse.sex}`) });
  if (age) items.push({ label: t('horses.detail.age'), value: age });
  if (horse.date_of_birth) items.push({ label: t('horses.detail.dateOfBirth'), value: horse.date_of_birth });
  if (horse.breed) items.push({ label: t('horses.detail.breed'), value: horse.breed });
  if (horse.level) items.push({ label: t('horses.detail.level'), value: horse.level });
  if (horse.height_cm != null) items.push({ label: t('horses.detail.height'), value: `${horse.height_cm} cm` });
  if (horse.weight_kg != null) items.push({ label: t('horses.detail.weight'), value: `${horse.weight_kg} kg` });
  if (horse.chip_number) items.push({ label: t('horses.detail.microchip'), value: horse.chip_number });

  if (items.length === 0 && !horse.photo_url) return null;

  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-5 sm:flex-row">
          {horse.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={horse.photo_url}
              alt={`${t('horses.detail.discipline')} — ${horse.name}`}
              className="h-40 w-40 shrink-0 rounded-lg border border-line bg-surface-muted object-cover"
            />
          ) : null}
          {items.length > 0 ? (
            <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {items.map((item) => (
                <div key={item.label}>
                  <dt className="text-[12px] uppercase tracking-wide text-text-tertiary">
                    {item.label}
                  </dt>
                  <dd className="text-[15px] text-text-primary">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
