// The mirrored modules: [mobile source, web copy]. Shared by check-mirror
// and vendor-mirror so the two can never disagree about the list.
export const MIRROR = [
  ['src/types/calendar.ts', 'src/types/calendar.ts'],
  ['src/utils/civilDate.ts', 'src/services/time/civilDate.ts'],
  ['src/utils/timezone.ts', 'src/services/time/timezone.ts'],
  ['src/schemas/trainingTargets.ts', 'src/services/calendar/trainingTargets.ts'],
  ['src/services/calendar/recurrenceService.ts', 'src/services/calendar/recurrenceService.ts'],
  ['src/services/calendar/occurrenceQuery.ts', 'src/services/calendar/occurrenceQuery.ts'],
  ['src/services/calendar/agendaGrouping.ts', 'src/services/calendar/agendaGrouping.ts'],
  ['src/services/calendar/rescheduleService.ts', 'src/services/calendar/rescheduleService.ts'],
  ['src/services/calendar/plannedVsActualService.ts', 'src/services/calendar/plannedVsActualService.ts'],
  ['src/schemas/plannedSnapshot.ts', 'src/services/calendar/plannedSnapshot.ts'],
  ['src/services/hrv/hrvService.ts', 'src/services/hrv/hrvService.ts'],
  ['src/components/loading/pulseGeometry.ts', 'src/components/brand/pulseGeometry.ts'],
  ['src/constants/motion.ts', 'src/theme/motion.ts'],
  ['src/services/calendar/targetBlocks.ts', 'src/services/calendar/targetBlocks.ts'],
  ['src/services/calendar/conflictResolution.ts', 'src/services/calendar/conflictResolution.ts'],
  ['src/services/health/healthReminders.ts', 'src/services/health/healthReminders.ts'],
];
