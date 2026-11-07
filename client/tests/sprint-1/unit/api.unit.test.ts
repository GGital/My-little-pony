import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, apiRequest, setSessionExpiredHandler } from '../../../src/api/client';
import { ApiError, parseApiError } from '../../../src/api/errors';

describe('api client & errors (Feature-C Behaviour 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setSessionExpiredHandler(null);
  });

  it('turns error response JSON into ApiError { status, code, message, details }', async () => {
    const errorPayload = {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'capacity', message: 'Capacity must be between 1 and 256' }],
      },
    };

    const mockResponse = new Response(JSON.stringify(errorPayload), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

    const apiError = await parseApiError(mockResponse);

    expect(apiError).toBeInstanceOf(ApiError);
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe('VALIDATION_FAILED');
    expect(apiError.message).toBe('Validation failed');
    expect(apiError.details).toEqual([
      { field: 'capacity', message: 'Capacity must be between 1 and 256' },
    ]);
  });

  it('calls no handler and does not navigate when auth: "optional" call returns 401', async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      apiRequest('/api/auth/me', { auth: 'optional' })
    ).rejects.toThrow('Unauthenticated');

    expect(handler).not.toHaveBeenCalled();
  });

  it('calls onSessionExpired handler once when default (auth: "required") call returns 401', async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Session expired' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      apiRequest('/api/me/registrations')
    ).rejects.toThrow('Session expired');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('sends credentials same-origin and Content-Type application/json on post', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await api.post('/api/events', { title: 'Test Event' });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ title: 'Test Event' }),
      })
    );
  });
});
