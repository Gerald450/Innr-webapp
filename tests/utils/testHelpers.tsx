import { QueryClient } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

/**
 * Create a new QueryClient for testing
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

/**
 * Wrapper component for React Query tests
 */
export function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/**
 * Wait for a condition to be true
 */
export function waitForCondition(condition: () => boolean, timeout = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Condition timeout'));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

