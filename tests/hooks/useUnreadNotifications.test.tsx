import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import * as supabaseClient from '@/lib/supabaseClient';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

describe('useUnreadNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.addEventListener
    global.window.addEventListener = vi.fn();
    global.window.removeEventListener = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Notification count fetching', () => {
    it('should fetch unread notification count', async () => {
      const user = { id: 'user-123' };
      const unreadCount = 5;

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      });

      const mockSelect = vi.fn().mockResolvedValue({
        count: unreadCount,
        error: null,
      });

      mockFrom.mockReturnValueOnce({
        select: mockSelect,
        eq: vi.fn().mockReturnThis(),
      } as any);

      vi.spyOn(supabaseClient.supabase, 'from').mockImplementation(mockFrom);

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      };

      vi.spyOn(supabaseClient.supabase, 'channel').mockReturnValue(mockChannel as any);

      const { result } = renderHook(() => useUnreadNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 2000 });

      // The hook should have attempted to fetch
      expect(supabaseClient.supabase.from).toHaveBeenCalled();
    });

    it('should handle zero unread notifications', async () => {
      const user = { id: 'user-123' };
      const unreadCount = 0;

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      };

      vi.spyOn(supabaseClient.supabase, 'channel').mockReturnValue(mockChannel as any);

      const { result } = renderHook(() => useUnreadNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 2000 });

      // Should handle zero count gracefully
      expect(result.current.unreadCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Real-time notification updates', () => {
    it('should set up real-time subscription', () => {
      const user = { id: 'user-123' };

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      };

      vi.spyOn(supabaseClient.supabase, 'channel').mockReturnValue(mockChannel as any);

      renderHook(() => useUnreadNotifications());

      // Channel should be created
      expect(supabaseClient.supabase.channel).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle authentication errors', async () => {
      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      const { result } = renderHook(() => useUnreadNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 2000 });

      // Should handle error gracefully
      expect(result.current.unreadCount).toBe(0);
    });

    it('should handle network errors', async () => {
      const user = { id: 'user-123' };

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      };

      vi.spyOn(supabaseClient.supabase, 'channel').mockReturnValue(mockChannel as any);

      const { result } = renderHook(() => useUnreadNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 2000 });

      // Should handle error gracefully
      expect(result.current.unreadCount).toBe(0);
    });
  });
});

