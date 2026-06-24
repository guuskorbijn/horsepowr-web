/**
 * HorsePowr brand tokens — "Vital" design system.
 *
 * SINGLE SOURCE OF TRUTH for colour, typography, spacing and radius on the web.
 * Platform-neutral: plain TS objects, no React and no react-native imports, so
 * this module can later be lifted into a shared package consumed by BOTH the
 * web app and the RN app. Do not invent colours or type sizes here — these are
 * transcribed verbatim from docs/DESIGN_SYSTEM.md (the "Vital" brand).
 *
 * Consumers:
 *  - tailwind theme + globals.css derive their values from here.
 *  - chart/code that needs a raw hex (e.g. HR-zone colour for an SVG fill)
 *    imports the relevant token directly.
 *
 * Reference SEMANTIC roles in UI, never raw ramp steps inline.
 */

// ---------------------------------------------------------------------------
// Colour ramps (the 500 step is the base brand colour).
// ---------------------------------------------------------------------------
export const palette = {
  blue: {
    50: '#E6F0F9', 100: '#C2DBEF', 200: '#8FBCE0', 300: '#5B9CD1',
    400: '#2D7CBF', 500: '#0058A2', 600: '#004886', 700: '#003A6C',
    800: '#002B50', 900: '#001D36',
  },
  coral: {
    50: '#FFEFEA', 100: '#FFD6C9', 200: '#FFB7A1', 300: '#FF9778',
    400: '#FF8A66', 500: '#FF7A59', 600: '#E85F3D', 700: '#C24A2D',
    800: '#8F3621', 900: '#5C2215',
  },
  ink: {
    0: '#FFFFFF', 50: '#F2F5F4', 100: '#E6ECEB', 200: '#CDD7D5',
    300: '#AAB8B6', 400: '#7E9290', 500: '#5C706E', 600: '#43534F',
    700: '#2C3B3A', 800: '#1D2C30', 900: '#15252B',
  },
} as const;

export const brand = {
  primary: palette.blue[500], // Pulse Blue
  accent: palette.coral[500], // Sunset Coral — one per screen, max
  ink: palette.ink[900],
  mist: palette.ink[50],
} as const;

// System feedback only — don't decorate with these.
export const semantic = {
  success: '#1FA971',
  warning: '#F2A20C',
  danger: '#E23D3D',
  info: '#2E7DD1',
} as const;

// ---------------------------------------------------------------------------
// Heart-rate training zones (the signature palette, cool -> hot).
// Colour ALWAYS pairs with a Z1–Z5 label in the UI, never colour alone.
// ---------------------------------------------------------------------------
export type ZoneKey = 'z1' | 'z2' | 'z3' | 'z4' | 'z5';

export interface HrZoneToken {
  readonly key: ZoneKey;
  readonly label: string;
  readonly color: string;
  readonly range: string;
}

export const hrZones: Readonly<Record<ZoneKey, HrZoneToken>> = {
  z1: { key: 'z1', label: 'Recovery', color: '#5B9CD1', range: '<60%' },
  z2: { key: 'z2', label: 'Easy', color: '#0058A2', range: '60–70%' },
  z3: { key: 'z3', label: 'Aerobic', color: '#F2C14E', range: '70–80%' },
  z4: { key: 'z4', label: 'Threshold', color: '#FF7A59', range: '80–90%' },
  z5: { key: 'z5', label: 'Max', color: '#E23D3D', range: '≥90%' },
};

// ---------------------------------------------------------------------------
// Gait estimation palette (WP8). Kept visually distinct from the HR-zone ramp
// so the two overlays never read as the same scale. Colour ALWAYS paired with
// a Walk/Trot/Canter/Inactive label — gait is an estimate from GPS speed.
// ---------------------------------------------------------------------------
export type GaitKey = 'inactive' | 'walk' | 'trot' | 'canter';

/** Violet anchor for Canter — gait-only, not part of the brand ramp. */
export const gaitViolet = '#7C5CC4';

export const gaitColors: Readonly<Record<GaitKey, string>> = {
  inactive: palette.ink[300],
  walk: palette.blue[300], // the Z1 cool cyan
  trot: semantic.success,
  canter: gaitViolet,
};

export const gaitLabels: Readonly<Record<GaitKey, string>> = {
  inactive: 'Inactive',
  walk: 'Walk',
  trot: 'Trot',
  canter: 'Canter',
};

// ---------------------------------------------------------------------------
// Spacing (4pt grid) and radius.
// ---------------------------------------------------------------------------
export const spacing = {
  xs4: 4, sm8: 8, md12: 12, lg16: 16, xl24: 24, xxl32: 32, xxxl48: 48,
} as const;

export const radius = {
  sm8: 8, md12: 12, lg16: 16, xl24: 24, pill999: 999,
} as const;

// ---------------------------------------------------------------------------
// Typography (Poppins display / Inter body). px sizes + unitless line heights.
// ---------------------------------------------------------------------------
export interface TypeToken {
  readonly size: number;
  readonly line: number;
  readonly family: 'display' | 'body';
  readonly weight: 400 | 500 | 600;
  readonly tabular?: boolean;
}

export const typography = {
  display: { size: 34, line: 40, family: 'display', weight: 600 },
  h1: { size: 28, line: 34, family: 'display', weight: 600 },
  h2: { size: 22, line: 28, family: 'display', weight: 600 },
  h3: { size: 18, line: 24, family: 'display', weight: 500 },
  bodyLg: { size: 17, line: 26, family: 'body', weight: 400 },
  body: { size: 15, line: 22, family: 'body', weight: 400 },
  bodySm: { size: 13, line: 18, family: 'body', weight: 400 },
  label: { size: 13, line: 16, family: 'body', weight: 500 },
  caption: { size: 12, line: 16, family: 'body', weight: 400 },
  metric: { size: 48, line: 52, family: 'display', weight: 600, tabular: true },
} as const satisfies Record<string, TypeToken>;
