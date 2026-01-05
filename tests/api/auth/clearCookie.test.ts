import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/clearCookie/route';

describe('POST /api/auth/clearCookie', () => {
  it('should clear both access and refresh token cookies', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/clearCookie', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data).toEqual({ ok: true });
    expect(response.status).toBe(200);

    // Check that cookies are set to be cleared (maxAge: 0)
    const setCookieHeaders = response.headers.getSetCookie();
    expect(setCookieHeaders.length).toBe(2);

    // Check access token cookie is cleared
    const accessCookie = setCookieHeaders.find((cookie) =>
      cookie.startsWith('sb-access-token=')
    );
    expect(accessCookie).toBeDefined();
    expect(accessCookie).toContain('Max-Age=0');
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('Path=/');

    // Check refresh token cookie is cleared
    const refreshCookie = setCookieHeaders.find((cookie) =>
      cookie.startsWith('sb-refresh-token=')
    );
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('Max-Age=0');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/');
  });

  it('should return success even without request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/clearCookie', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data).toEqual({ ok: true });
    expect(response.status).toBe(200);
  });
});

