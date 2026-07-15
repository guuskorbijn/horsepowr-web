'use client';

import { useMemo, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { useOrg } from '@/components/shell/OrgContext';
import { Input } from '@/components/ui/Input';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/states';
import { HorseCard } from '@/components/command/HorseCard';
import type { HorseLastSession } from '@/types/view';

interface Group {
  id: string | null;
  name: string;
  country: string | null;
  entries: HorseLastSession[];
}

export function CommandCenter({ horses }: { horses: HorseLastSession[] }) {
  const { org, locations, selectedLocationId } = useOrg();
  const [search, setSearch] = useState('');

  const groups = useMemo<Group[]>(() => {
    const term = search.trim().toLowerCase();
    const match = (e: HorseLastSession) =>
      (!selectedLocationId || e.horse.location_id === selectedLocationId) &&
      (term === '' || e.horse.name.toLowerCase().includes(term));

    const filtered = horses.filter(match);
    const result: Group[] = [];
    for (const loc of locations) {
      const entries = filtered.filter((e) => e.horse.location_id === loc.id);
      if (entries.length > 0) {
        result.push({ id: loc.id, name: loc.name, country: loc.country, entries });
      }
    }
    const unassigned = filtered.filter((e) => e.horse.location_id === null);
    if (unassigned.length > 0) {
      result.push({ id: null, name: 'Unassigned', country: null, entries: unassigned });
    }
    return result;
  }, [horses, locations, selectedLocationId, search]);

  const total = groups.reduce((acc, g) => acc + g.entries.length, 0);

  return (
    <div className="space-y-8">
      {org?.logo_url ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={org.logo_url}
            alt={`${org.name} logo`}
            className="h-12 max-w-[180px] object-contain"
          />
        </div>
      ) : null}

      <div className="relative max-w-xs">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search horses"
          className="pl-9"
          aria-label="Search horses"
        />
      </div>

      {total === 0 ? (
        <EmptyState
          title="No horses match"
          description="Try a different search, or switch the location filter in the top bar."
        />
      ) : (
        groups.map((group) => (
          <section key={group.id ?? 'unassigned'}>
            <div className="mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-text-tertiary" />
              <h2 className="font-display text-[18px] font-medium text-text-primary">
                {group.name}
              </h2>
              {group.country ? <StatusPill tone="muted">{group.country}</StatusPill> : null}
              <span className="text-[13px] text-text-tertiary">
                {group.entries.length} {group.entries.length === 1 ? 'horse' : 'horses'}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.entries.map((entry) => (
                <HorseCard key={entry.horse.id} entry={entry} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
