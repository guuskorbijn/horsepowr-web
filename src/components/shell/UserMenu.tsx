'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { ROLE_LABELS } from '@/lib/roles';
import type { UserRole } from '@/types/db';
import { cn } from '@/lib/cn';

export interface SessionUser {
  name: string;
  email: string;
  role: UserRole;
}

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function signOut() {
    setSigningOut(true);
    const { error } = await getBrowserSupabase().auth.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-muted"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
          <UserIcon size={16} />
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-[13px] font-medium text-text-primary">{user.name}</span>
          <span className="block text-[11px] text-text-secondary">{ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronDown size={16} className="text-text-tertiary" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-line bg-surface p-1.5 shadow-[var(--shadow-raised)]"
        >
          <div className="px-3 py-2">
            <p className="truncate text-[13px] font-medium text-text-primary">{user.name}</p>
            <p className="truncate text-[12px] text-text-secondary">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-text-primary transition-colors hover:bg-surface-muted',
              signingOut && 'opacity-60',
            )}
            role="menuitem"
          >
            <LogOut size={16} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
