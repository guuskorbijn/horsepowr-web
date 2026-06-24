import { LocationSwitcher } from '@/components/shell/LocationSwitcher';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { UserMenu, type SessionUser } from '@/components/shell/UserMenu';

export function TopBar({ user }: { user: SessionUser }) {
  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-app/80 px-6 backdrop-blur">
      <LocationSwitcher />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
