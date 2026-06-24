'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, MapPin } from 'lucide-react';
import { useOrg } from '@/components/shell/OrgContext';
import { cn } from '@/lib/cn';

/** Org/location context switcher in the top bar. Sets the org-wide location
 *  filter consumed by the command center, sessions and trends views. */
export function LocationSwitcher() {
  const { org, locations, selectedLocationId, setSelectedLocationId } = useOrg();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selected = locations.find((l) => l.id === selectedLocationId) ?? null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-left transition-colors hover:bg-surface-muted"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Building2 size={16} className="text-text-tertiary" />
        <span className="leading-tight">
          <span className="block text-[13px] font-medium text-text-primary">
            {org?.name ?? 'No organization'}
          </span>
          <span className="block text-[11px] text-text-secondary">
            {selected ? selected.name : 'All locations'}
          </span>
        </span>
        <ChevronDown size={16} className="text-text-tertiary" />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 z-30 mt-2 w-60 rounded-lg border border-line bg-surface p-1.5 shadow-[var(--shadow-raised)]"
        >
          <LocationOption
            label="All locations"
            active={selectedLocationId === null}
            onSelect={() => {
              setSelectedLocationId(null);
              setOpen(false);
            }}
          />
          {locations.map((loc) => (
            <LocationOption
              key={loc.id}
              label={loc.name}
              hint={loc.country ?? undefined}
              active={selectedLocationId === loc.id}
              onSelect={() => {
                setSelectedLocationId(loc.id);
                setOpen(false);
              }}
            />
          ))}
          {locations.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-text-secondary">No locations yet.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LocationOption({
  label,
  hint,
  active,
  onSelect,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] transition-colors hover:bg-surface-muted',
        active ? 'text-primary' : 'text-text-primary',
      )}
    >
      <MapPin size={15} className="text-text-tertiary" />
      <span className="flex-1 text-left">{label}</span>
      {hint ? <span className="text-[11px] text-text-tertiary">{hint}</span> : null}
      {active ? <Check size={15} /> : null}
    </button>
  );
}
