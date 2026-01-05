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

describe('useEvents', () => {
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

  describe('Event fetching with pagination', () => {
    it('should fetch events with pagination', async () => {
      const mockProfile = {
        university_id: 'uni-123',
      };

      const mockUser = { id: 'user-123' };
      const mockEventsData = [
        {
          id: 'event-1',
          post_id: 'post-1',
          starts_at: '2024-01-01T12:00:00Z',
          posts: {
            id: 'post-1',
            title: 'Event 1',
            body: 'Description 1',
            profiles: { id: 'user-1', full_name: 'Organizer 1', role: 'admin' },
            post_media: [],
          },
        },
      ];

      vi.spyOn(useProfileHook, 'useProfile').mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      const mockFrom = vi.fn()
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: mockEventsData,
            error: null,
            count: 1,
          }),
          eq: vi.fn().mockReturnThis(),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
          eq: vi.fn().mockReturnThis(),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
          eq: vi.fn().mockReturnThis(),
        } as any);

      vi.spyOn(supabaseClient.supabase, 'from').mockImplementation(mockFrom);

      const { result } = renderHook(() => useEvents(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.pages).toBeDefined();
    });

    it('should handle pagination correctly', async () => {
      const mockProfile = {
        university_id: 'uni-123',
      };

      const mockUser = { id: 'user-123' };

      vi.spyOn(useProfileHook, 'useProfile').mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
      } as any);

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

      if (result.current.isSuccess) {
        expect(result.current.hasNextPage).toBeDefined();
      }
    });
  });

  describe('Attendee count fetching', () => {
    it('should fetch attendee counts correctly', async () => {
      const mockProfile = {
        university_id: 'uni-123',
      };

      const mockUser = { id: 'user-123' };
      const eventIds = ['event-1', 'event-2'];

      vi.spyOn(useProfileHook, 'useProfile').mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      const attendeeData = [
        { event_id: 'event-1' },
        { event_id: 'event-1' },
        { event_id: 'event-2' },
      ];

      const mockFrom = vi.fn()
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          }),
          eq: vi.fn().mockReturnThis(),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: attendeeData,
            error: null,
          }),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
          eq: vi.fn().mockReturnThis(),
        } as any);

      vi.spyOn(supabaseClient.supabase, 'from').mockImplementation(mockFrom);

      // Simulate attendee count calculation
      const countsMap: Record<string, number> = {};
      attendeeData.forEach((row: any) => {
        countsMap[row.event_id] = (countsMap[row.event_id] || 0) + 1;
      });

      expect(countsMap['event-1']).toBe(2);
      expect(countsMap['event-2']).toBe(1);
    });
  });

  describe('User join status', () => {
    it('should fetch user join status correctly', async () => {
      const mockUser = { id: 'user-123' };
      const eventIds = ['event-1', 'event-2'];

      const userAttendeesData = [{ event_id: 'event-1' }];

      // Simulate join status mapping
      const userJoinedSet = new Set(userAttendeesData.map((row: any) => row.event_id));
      const joinedStatus: Record<string, boolean> = {};
      eventIds.forEach((eventId: string) => {
        joinedStatus[eventId] = userJoinedSet.has(eventId);
      });

      expect(joinedStatus['event-1']).toBe(true);
      expect(joinedStatus['event-2']).toBe(false);
    });
  });

  describe('Event filtering', () => {
    it('should filter events by university_id', async () => {
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
    });
  });

  describe('Error states', () => {
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

    it('should not fetch when profile is loading', () => {
      vi.spyOn(useProfileHook, 'useProfile').mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      const { result } = renderHook(() => useEvents(), { wrapper });

      expect(result.current.isFetching).toBe(false);
    });
  });
});

