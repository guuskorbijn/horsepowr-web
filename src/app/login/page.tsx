import { Suspense } from 'react';
import { LoginCard } from '@/components/auth/LoginCard';
import { LogoMark } from '@/components/brand/Logo';

export const metadata = { title: 'Sign in · HorsePowr' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark size={48} />
          <h1 className="mt-4 font-display text-[28px] font-semibold text-text-primary">
            Sign in to HorsePowr
          </h1>
          <p className="mt-1 text-[14px] text-text-secondary">
            Read, analyze and manage your stable&apos;s training data.
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginCard />
        </Suspense>
      </div>
    </main>
  );
}
