import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  Activity,
  GitCompareArrows,
  TrendingUp,
  Sparkles,
  Settings,
} from 'lucide-react';
import { HorseIcon } from '@/components/icons/HorseIcon';

/** Any glyph that accepts size + className (Lucide icons and our custom ones). */
export type NavIcon = ComponentType<{ size?: number; className?: string }>;

export interface NavItem {
  href: string;
  /** i18n key resolved in the Sidebar (client) via useTranslation. */
  labelKey: string;
  icon: NavIcon;
}

/** Left sidebar nav. "Horses" doubles as the management home (WP-W10). */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', labelKey: 'nav.commandCenter', icon: LayoutDashboard },
  { href: '/sessions', labelKey: 'nav.sessions', icon: Activity },
  { href: '/compare', labelKey: 'nav.compare', icon: GitCompareArrows },
  { href: '/trends', labelKey: 'nav.trends', icon: TrendingUp },
  { href: '/analyst', labelKey: 'nav.analyst', icon: Sparkles },
  { href: '/horses', labelKey: 'nav.horses', icon: HorseIcon },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings },
];
