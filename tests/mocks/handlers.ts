import { http, HttpResponse } from 'msw';

// Mock handlers for MSW (Mock Service Worker)
// These can be extended as needed for specific API tests

export const handlers = [
  // Add specific API route handlers here as needed
  // Example:
  // http.post('/api/auth/setCookie', () => {
  //   return HttpResponse.json({ ok: true });
  // }),
];

