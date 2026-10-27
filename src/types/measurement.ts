import type { MeasurementRow } from '@/types/db';

/**
 * The mobile repo's name for a measurement row. Exists so mirrored modules
 * keep their source's import path; on web it IS the database row.
 */
export type Measurement = MeasurementRow;
