'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, KeyRound, CheckCircle2 } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

type Method = 'password' | 'magic';

function safeNext(next: string | null): string {
  // Only allow same-app relative paths (no open redirects).
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/';
}

export function LoginCard() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));

  const [method, setMethod] = useState<Method>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    params.get('error') === 'link-expired'
      ? 'That sign-in link has expired. Request a new one below.'
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supa = getBrowserSupabase();

    if (method === 'password') {
      const { error: err } = await supa.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
      return;
    }

    // Magic link
    const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;
    const { error: err } = await supa.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    setMagicSent(true);
    setBusy(false);
  }

  if (magicSent) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 size={28} className="text-success" />
          <h2 className="font-display text-[18px] font-medium text-text-primary">
            Check your email
          </h2>
          <p className="text-[14px] text-text-secondary">
            We sent a sign-in link to <span className="font-medium">{email}</span>. Open it on
            this device to continue.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setMagicSent(false)}>
            Use a different method
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-muted p-1">
          <MethodTab
            active={method === 'password'}
            onClick={() => setMethod('password')}
            icon={<KeyRound size={15} />}
            label="Password"
          />
          <MethodTab
            active={method === 'magic'}
            onClick={() => setMethod('magic')}
            icon={<Mail size={15} />}
            label="Magic link"
          />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@stable.com"
            />
          </Field>

          {method === 'password' ? (
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
            </Field>
          ) : null}

          {error ? (
            <p className="rounded-md bg-[var(--pill-warning-bg)] px-3 py-2 text-[13px] text-[var(--pill-warning-text)]">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? 'Working…'
              : method === 'password'
                ? 'Sign in'
                : 'Send magic link'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function MethodTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-[6px] py-2 text-[13px] font-medium transition-colors',
        active ? 'bg-surface text-text-primary shadow-[var(--shadow-card)]' : 'text-text-secondary',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
