import { LocationSwitcher } from '@/components/shell/LocationSwitcher';
import { MobileNav } from '@/components/shell/MobileNav';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { UserMenu, type SessionUser } from '@/components/shell/UserMenu';

export function TopBar({ user }: { user: SessionUser }) {
  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-app/80 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNav />
        <LocationSwitcher />
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
