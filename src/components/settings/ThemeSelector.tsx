'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { useTranslation } from '@/i18n/LocaleProvider';
import { cn } from '@/lib/cn';

const OPTIONS: Array<{ mode: ThemeMode; labelKey: string; icon: typeof Sun }> = [
  { mode: 'light', labelKey: 'settings.themeLight', icon: Sun },
  { mode: 'dark', labelKey: 'settings.themeDark', icon: Moon },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  return (
    <div className="flex gap-3">
      {OPTIONS.map(({ mode, labelKey, icon: Icon }) => {
        const active = theme === mode;
        const label = t(labelKey);
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setTheme(mode)}
            aria-pressed={active}
            className={cn(
              'flex flex-1 items-center gap-3 rounded-md border px-4 py-3 text-[14px] font-medium transition-colors',
              active
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-line text-text-secondary hover:bg-surface-muted',
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
