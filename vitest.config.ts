import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest — pure-service unit tests only. The physiology math (effort detection,
 * HR–speed / V-index, recovery descent, weekly volume) is where correctness
 * lives, so it is checked against hand-verified fixtures. No DOM, no Next.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
