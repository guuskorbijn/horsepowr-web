import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  Activity,
  GitCompareArrows,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { HorseIcon } from '@/components/icons/HorseIcon';

/** Any glyph that accepts size + className (Lucide icons and our custom ones). */
export type NavIcon = ComponentType<{ size?: number; className?: string }>;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

/** Left sidebar nav. "Horses" doubles as the management home (WP-W10). */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Command center', icon: LayoutDashboard },
  { href: '/sessions', label: 'Sessions', icon: Activity },
  { href: '/compare', label: 'Compare', icon: GitCompareArrows },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
  { href: '/horses', label: 'Horses', icon: HorseIcon },
  { href: '/settings', label: 'Settings', icon: Settings },
];
