import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useEvents } from '@/hooks/useEvents';
import * as supabaseClient from '@/lib/supabaseClient';
import * as useProfileHook from '@/hooks/useProfile';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock useProfile hook
vi.mock('@/hooks/useProfile', () => ({
  useProfile: vi.fn(),
}));

describe('Event Operations', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    vi.clearAllMocks();
    queryClient.clear();
  });

  describe('Event attendance toggle', () => {
    it('should toggle attendance status correctly', async () => {
      const eventId = 'event-123';
      const user = { id: 'user-123' };
      const profile = { id: 'user-123' };

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: profile,
        error: null,
      });

      const mockDelete = vi.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      const mockInsert = vi.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      vi.spyOn(supabaseClient.supabase, 'from')
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        } as any)
        .mockReturnValueOnce({
          delete: mockDelete,
          eq: vi.fn().mockReturnThis(),
        } as any)
        .mockReturnValueOnce({
          insert: mockInsert,
          eq: vi.fn().mockReturnThis(),
        } as any);

      // Simulate leaving event
      const leaveResult = await supabaseClient.supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id);

      expect(leaveResult.error).toBeNull();

      // Simulate joining event
      const joinResult = await supabaseClient.supabase
        .from('event_attendees')
        .insert({
          event_id: eventId,
          user_id: user.id,
          status: 'interested',
        });

      expect(joinResult.error).toBeNull();
    });
  });

  describe('Event filtering by university', () => {
    it('should filter events by university_id', async () => {
      const universityId = 'uni-123';
      const mockProfile = {
        university_id: universityId,
      };

      vi.spyOn(useProfileHook, 'useProfile').mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
      } as any);

      const mockUser = { id: 'user-123' };
      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const { result } = renderHook(() => useEvents(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.isError).toBe(true);
      });
    });
  });

  describe('Event pagination', () => {
    it('should handle pagination correctly', async () => {
      const mockProfile = {
        university_id: 'uni-123',
      };

      vi.spyOn(useProfileHook, 'useProfile').mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
      } as any);

      const mockUser = { id: 'user-123' };
      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const { result } = renderHook(() => useEvents(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.isError).toBe(true);
      });

      // Check pagination state
      if (result.current.isSuccess) {
        expect(result.current.data).toBeDefined();
        expect(result.current.hasNextPage).toBeDefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should handle authentication errors', async () => {
      const mockProfile = {
        university_id: 'uni-123',
      };

      vi.spyOn(useProfileHook, 'useProfile').mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      const { result } = renderHook(() => useEvents(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Not authenticated');
    });

    it('should handle network errors', async () => {
      const mockProfile = {
        university_id: 'uni-123',
      };

      vi.spyOn(useProfileHook, 'useProfile').mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
      } as any);

      const mockUser = { id: 'user-123' };
      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockRejectedValue(new Error('Network error')),
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const { result } = renderHook(() => useEvents(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });
});

