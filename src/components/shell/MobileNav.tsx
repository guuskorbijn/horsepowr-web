'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { NAV_ITEMS } from '@/components/shell/nav';
import { LogoWordmark } from '@/components/brand/Logo';
import { useTranslation } from '@/i18n/LocaleProvider';
import { cn } from '@/lib/cn';

/** Same active rule as the desktop Sidebar so the two stay in lockstep. */
function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Mobile navigation: the responsive counterpart to the desktop `Sidebar`.
 * Renders a hamburger trigger (hidden ≥ md) plus an off-canvas drawer that
 * reuses the exact same `NAV_ITEMS`, logo, active-state and link styling — no
 * new nav pattern, no new visual language. Desktop is untouched (the drawer and
 * trigger are `md:hidden`; the persistent sidebar owns ≥ md).
 */
export function MobileNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Every nav Link and the logo close the sheet in their onClick, so navigation
  // dismisses it without a route-change effect (which would setState in-effect).

  // While open: Escape closes, and the body scroll is locked behind the sheet.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('shell.openMenu')}
        aria-expanded={open}
        className="no-print flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary md:hidden"
      >
        <Menu size={22} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t('shell.primaryNavAria')}
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            role="presentation"
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col border-r border-line bg-surface shadow-[var(--shadow-raised)]"
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              paddingLeft: 'env(safe-area-inset-left)',
            }}
          >
            <div className="flex h-16 items-center justify-between px-4">
              <Link href="/" aria-label={t('shell.homeAria')} onClick={() => setOpen(false)}>
                <LogoWordmark />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('shell.closeMenu')}
                className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>
            <nav
              className="flex-1 space-y-1 overflow-y-auto px-3 py-2"
              aria-label={t('shell.primaryNavAria')}
            >
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-3 text-[15px] font-medium transition-colors',
                      active
                        ? 'bg-primary-soft text-primary'
                        : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
                    )}
                  >
                    <Icon size={20} className="shrink-0" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </nav>
            <div className="px-5 py-4 text-[12px] text-text-tertiary">{t('shell.footnote')}</div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
