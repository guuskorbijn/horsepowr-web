/** Tiny class-name joiner. Falsy values are dropped. Keeps component markup
 *  readable without pulling in a dependency. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
