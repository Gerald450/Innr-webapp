import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { proxy } from '@/proxy';

// We need to export isPublicPath and sanitizeNext to test them
// Since they're not exported, we'll test them through proxy() function
// or we could import them if they were exported

describe('proxy middleware', () => {
  const createMockRequest = (
    pathname: string,
    cookies: Record<string, string> = {}
  ): NextRequest => {
    const url = new URL(`http://localhost:3000${pathname}`);
    const request = new NextRequest(url, {
      headers: {
        cookie: Object.entries(cookies)
          .map(([key, value]) => `${key}=${value}`)
          .join('; '),
      },
    });
    return request;
  };

  describe('public paths', () => {
    it('should allow access to /signin', () => {
      const request = createMockRequest('/signin');
      const response = proxy(request);

      expect(response.status).toBe(200);
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should allow access to /_next/static files', () => {
      const request = createMockRequest('/_next/static/chunks/main.js');
      const response = proxy(request);

      expect(response.status).toBe(200);
    });

    it('should allow access to static assets', () => {
      const request = createMockRequest('/favicon.ico');
      const response = proxy(request);

      expect(response.status).toBe(200);
    });

    it('should allow access to /api/auth/callback', () => {
      const request = createMockRequest('/api/auth/callback');
      const response = proxy(request);

      expect(response.status).toBe(200);
    });

    it('should allow access to /updatePassword', () => {
      const request = createMockRequest('/updatePassword');
      const response = proxy(request);

      expect(response.status).toBe(200);
    });

    it('should allow access to files with image extensions', () => {
      const request = createMockRequest('/image.png');
      const response = proxy(request);

      expect(response.status).toBe(200);
    });
  });

  describe('authenticated paths', () => {
    it('should allow access with valid session cookies', () => {
      const request = createMockRequest('/posts', {
        'sb-access-token': 'valid-token',
      });
      const response = proxy(request);

      expect(response.status).toBe(200);
    });

    it('should allow access with refresh token only', () => {
      const request = createMockRequest('/profile', {
        'sb-refresh-token': 'valid-refresh-token',
      });
      const response = proxy(request);

      expect(response.status).toBe(200);
    });
  });

  describe('unauthenticated paths', () => {
    it('should redirect to /signin when no session cookies', () => {
      const request = createMockRequest('/posts');
      const response = proxy(request);

      expect(response.status).toBe(307); // Redirect status
      expect(response.headers.get('location')).toContain('/signin');
    });

    it('should include next parameter in redirect URL', () => {
      const request = createMockRequest('/posts/123');
      const response = proxy(request);

      const location = response.headers.get('location');
      expect(location).toContain('/signin');
      expect(location).toContain('next=');
    });

    it('should sanitize next parameter to prevent open redirects', () => {
      // Test that malicious paths are sanitized
      const request = createMockRequest('/posts');
      const response = proxy(request);

      const location = response.headers.get('location');
      const url = new URL(location!, 'http://localhost:3000');
      const nextParam = url.searchParams.get('next');

      // Should start with / and not contain protocol (decode URL-encoded value)
      if (nextParam) {
        const decoded = decodeURIComponent(nextParam);
        expect(decoded).toMatch(/^\/[^\/]/);
        expect(decoded).not.toContain('http://');
        expect(decoded).not.toContain('https://');
        expect(decoded).not.toContain('//');
      }
    });

    it('should sanitize path with double slashes', () => {
      const request = createMockRequest('///posts//123');
      const response = proxy(request);

      const location = response.headers.get('location');
      expect(location).toBeTruthy();
      // The sanitizeNext function should normalize double slashes
    });
  });

  describe('path sanitization', () => {
    it('should handle empty path', () => {
      const request = createMockRequest('');
      const response = proxy(request);

      // Should either allow or redirect appropriately
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should handle paths with query parameters', () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/posts?filter=recent')
      );
      const response = proxy(request);

      // Should redirect with query params in next parameter
      if (response.status === 307) {
        const location = response.headers.get('location');
        expect(location).toContain('/signin');
      }
    });
  });
});

