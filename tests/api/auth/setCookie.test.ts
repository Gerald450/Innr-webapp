import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/setCookie/route';

describe('POST /api/auth/setCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should set cookies with valid access and refresh tokens', async () => {
    const body = {
      access: 'test-access-token',
      refresh: 'test-refresh-token',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/setCookie', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data).toEqual({ ok: true });
    expect(response.status).toBe(200);

    // Check that cookies are set
    const setCookieHeaders = response.headers.getSetCookie();
    expect(setCookieHeaders.length).toBe(2);

    // Check access token cookie
    const accessCookie = setCookieHeaders.find((cookie) =>
      cookie.startsWith('sb-access-token=')
    );
    expect(accessCookie).toBeDefined();
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('Path=/');
    expect(accessCookie).toMatch(/SameSite=lax/i);

    // Check refresh token cookie
    const refreshCookie = setCookieHeaders.find((cookie) =>
      cookie.startsWith('sb-refresh-token=')
    );
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/');
    expect(refreshCookie).toMatch(/SameSite=lax/i);
  });

  it('should set secure flag in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const body = {
      access: 'test-access-token',
      refresh: 'test-refresh-token',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/setCookie', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const setCookieHeaders = response.headers.getSetCookie();

    // Check that cookies have Secure flag in production
    const accessCookie = setCookieHeaders.find((cookie) =>
      cookie.startsWith('sb-access-token=')
    );
    expect(accessCookie).toContain('Secure');
  });

  it('should not set secure flag in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const body = {
      access: 'test-access-token',
      refresh: 'test-refresh-token',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/setCookie', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const setCookieHeaders = response.headers.getSetCookie();

    const accessCookie = setCookieHeaders.find((cookie) =>
      cookie.startsWith('sb-access-token=')
    );
    expect(accessCookie).not.toContain('Secure');
  });

  it('should return 400 when access token is missing', async () => {
    const body = {
      refresh: 'test-refresh-token',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/setCookie', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, message: 'Missing tokens' });
  });

  it('should return 400 when refresh token is missing', async () => {
    const body = {
      access: 'test-access-token',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/setCookie', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, message: 'Missing tokens' });
  });

  it('should return 400 when both tokens are missing', async () => {
    const body = {};

    const request = new NextRequest('http://localhost:3000/api/auth/setCookie', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, message: 'Missing tokens' });
  });

  it('should return 500 on invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/setCookie', {
      method: 'POST',
      body: 'invalid json',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, message: 'Server error' });
  });

  it('should set correct maxAge for access token (8 hours)', async () => {
    const body = {
      access: 'test-access-token',
      refresh: 'test-refresh-token',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/setCookie', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const setCookieHeaders = response.headers.getSetCookie();

    const accessCookie = setCookieHeaders.find((cookie) =>
      cookie.startsWith('sb-access-token=')
    );
    // MaxAge for access token should be 8 hours = 28800 seconds
    expect(accessCookie).toMatch(/Max-Age=28800/);
  });

  it('should set correct maxAge for refresh token (30 days)', async () => {
    const body = {
      access: 'test-access-token',
      refresh: 'test-refresh-token',
    };

    const request = new NextRequest('http://localhost:3000/api/auth/setCookie', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const setCookieHeaders = response.headers.getSetCookie();

    const refreshCookie = setCookieHeaders.find((cookie) =>
      cookie.startsWith('sb-refresh-token=')
    );
    // MaxAge for refresh token should be 30 days = 2592000 seconds
    expect(refreshCookie).toMatch(/Max-Age=2592000/);
  });
});

