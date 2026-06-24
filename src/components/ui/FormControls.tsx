import {
  forwardRef,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'h-[44px] w-full rounded-md border border-line bg-surface px-3 text-[15px] text-text-primary',
          'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
          'disabled:opacity-60',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-24 w-full rounded-md border border-line bg-surface px-3 py-2 text-[15px] text-text-primary',
        'placeholder:text-text-tertiary',
        'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
        'disabled:opacity-60',
        className,
      )}
      {...rest}
    />
  );
});

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-center gap-2.5 disabled:opacity-60',
        disabled ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'relative h-6 w-10 rounded-pill transition-colors',
          checked ? 'bg-primary' : 'bg-surface-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
      <span className="text-[14px] text-text-primary">{label}</span>
    </button>
  );
}

/** 1–5 subjective rating picker, with a "clear" option. Descriptive, not a grade. */
export function RatingPicker({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value !== null && n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={value === n}
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md border text-[14px] font-medium transition-colors',
              active
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-line text-text-secondary hover:bg-surface-muted',
              disabled && 'cursor-default opacity-60',
            )}
          >
            {n}
          </button>
        );
      })}
      {value !== null && !disabled ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 text-[12px] text-text-tertiary hover:text-text-primary"
        >
          Clear
        </button>
      ) : null}
      {value !== null ? <Check size={15} className="text-success" /> : null}
    </div>
  );
}
