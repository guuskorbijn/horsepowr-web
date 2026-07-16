// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AnalystChat } from '@/components/analyst/AnalystChat';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AnalystChat', () => {
  it('shows an inviting empty state with real, horse-specific example questions', () => {
    render(<AnalystChat firstHorseName="Luna" />);
    expect(screen.getByText('Ask the analyst')).toBeDefined();
    expect(screen.getByText('What did Luna do yesterday?')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send question' })).toBeDefined();
  });

  it('sends a question and renders the analyst reply (mocked fetch)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Luna did an 80 min interval session.', toolTrace: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalystChat firstHorseName="Luna" />);
    fireEvent.click(screen.getByText('What did Luna do yesterday?'));

    await waitFor(() =>
      expect(screen.getByText('Luna did an 80 min interval session.')).toBeDefined(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/analyst/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
