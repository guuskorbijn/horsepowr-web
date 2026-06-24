import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-[44px] w-full rounded-md border border-line bg-surface px-3 text-[15px] text-text-primary',
          'placeholder:text-text-tertiary',
          'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
          'disabled:opacity-60',
          className,
        )}
        {...rest}
      />
    );
  },
);

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-text-primary">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[12px] text-text-secondary">{hint}</p> : null}
    </div>
  );
}
