import type { CalendarEventType } from '@/types/calendar';

/**
 * One colour per kind of agenda item, used everywhere the kind shows: agenda
 * cards, the week grid on the dashboard, day dots and notifications. Theme
 * tokens only, so light/dark stay right. Coral (`--accent`) is absent on
 * purpose: it is reserved for the single primary action on a screen. The
 * phone's `eventTypeColor` maps the same kinds to the same token families.
 */
export const TYPE_ACCENT: Record<CalendarEventType, string> = {
  training: 'var(--primary)',
  vet: 'var(--info)',
  physio: 'var(--success)',
  farrier: 'var(--warning)',
  competition: 'var(--color-gait-canter)',
  other: 'var(--line-strong)',
};
