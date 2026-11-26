import { describe, expect, it } from 'vitest';
import { rankCommands } from './commandSearch';

describe('rankCommands', () => {
  const items = [
    { id: 'plan', label: 'Iets plannen…', keywords: 'new training' },
    { id: 'b', label: 'Bella Donna' },
    { id: 'bs', label: 'Bella Donna → laatste sessie', keywords: 'latest' },
    { id: 'z', label: 'Zephyr van de Rith' },
  ];
  it('prefers a label prefix and keeps input order on ties', () => {
    expect(rankCommands(items, 'bel').map((i) => i.id)).toEqual(['b', 'bs']);
  });
  it('matches word starts and keywords, accent-insensitive', () => {
    expect(rankCommands(items, 'rith').map((i) => i.id)).toEqual(['z']);
    expect(rankCommands(items, 'training').map((i) => i.id)).toEqual(['plan']);
  });
});
