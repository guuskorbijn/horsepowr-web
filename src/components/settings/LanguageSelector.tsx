'use client';

import { SUPPORTED_LOCALES } from '@/i18n';
import { useTranslation } from '@/i18n/LocaleProvider';
import { cn } from '@/lib/cn';

/** Language switcher — EN/NL live, ES scaffold. Persists via cookie + refresh. */
export function LanguageSelector() {
  const { locale, setLocale } = useTranslation();
  return (
    <div className="flex flex-wrap gap-3">
      {SUPPORTED_LOCALES.map(({ code, label }) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            className={cn(
              'flex-1 rounded-md border px-4 py-3 text-[14px] font-medium transition-colors',
              active
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-line text-text-secondary hover:bg-surface-muted',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
