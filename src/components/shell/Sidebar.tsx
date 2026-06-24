'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/components/shell/nav';
import { LogoWordmark } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/" aria-label="HorsePowr home">
          <LogoWordmark />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors',
                active
                  ? 'bg-primary-soft text-primary'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
              )}
            >
              <Icon size={20} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-[12px] text-text-tertiary">
        Read & analyze · capture lives in the app
      </div>
    </aside>
  );
}
