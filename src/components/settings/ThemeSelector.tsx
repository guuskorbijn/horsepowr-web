'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { cn } from '@/lib/cn';

const OPTIONS: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex gap-3">
      {OPTIONS.map(({ mode, label, icon: Icon }) => {
        const active = theme === mode;
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
