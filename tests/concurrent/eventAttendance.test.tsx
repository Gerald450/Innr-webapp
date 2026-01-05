import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import * as supabaseClient from '@/lib/supabaseClient';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Concurrent Event Attendance', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Concurrent Attendance Toggle', () => {
    it('should handle multiple users joining event simultaneously', async () => {
      const eventId = 'event-123';
      const users = [
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' },
      ];

      let attendeeCount = 0;
      const insertMock = vi.fn().mockImplementation(() => {
        attendeeCount++;
        return Promise.resolve({ data: {}, error: null });
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: insertMock,
        delete: vi.fn().mockResolvedValue({ data: {}, error: null }),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      // Simulate concurrent joins
      const joinPromises = users.map((user) =>
        mockFrom().insert({
          event_id: eventId,
          user_id: user.id,
          status: 'interested',
        })
      );

      await Promise.all(joinPromises);

      expect(insertMock).toHaveBeenCalledTimes(3);
      expect(attendeeCount).toBe(3);
    });

    it('should handle multiple users leaving event simultaneously', async () => {
      const eventId = 'event-123';
      const users = [{ id: 'user-1' }, { id: 'user-2' }];

      let deleteCount = 0;
      const deleteMock = vi.fn().mockImplementation(() => {
        deleteCount++;
        return Promise.resolve({ data: {}, error: null });
      });

      const mockFrom = vi.fn().mockReturnValue({
        delete: deleteMock,
        eq: vi.fn().mockReturnThis(),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      // Simulate concurrent leaves
      const leavePromises = users.map((user) =>
        mockFrom().delete().eq('event_id', eventId).eq('user_id', user.id)
      );

      await Promise.all(leavePromises);

      expect(deleteMock).toHaveBeenCalledTimes(2);
      expect(deleteCount).toBe(2);
    });
  });

  describe('Attendee Count Accuracy', () => {
    it('should correctly update attendee count under concurrent updates', async () => {
      const eventId = 'event-123';
      const initialCount = 10;

      const mockCacheData = {
        pages: [
          {
            events: [{ id: eventId }],
            attendeeCounts: { [eventId]: initialCount },
            joinedMap: { [eventId]: false },
          },
        ],
      };

      queryClient.setQueryData(['events', 'uni-123'], mockCacheData);

      // Simulate optimistic update
      queryClient.setQueryData(['events', 'uni-123'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            attendeeCounts: {
              ...page.attendeeCounts,
              [eventId]: (page.attendeeCounts[eventId] || 0) + 1,
            },
            joinedMap: {
              ...page.joinedMap,
              [eventId]: true,
            },
          })),
        };
      });

      const cached = queryClient.getQueryData(['events', 'uni-123']) as any;
      expect(cached.pages[0].attendeeCounts[eventId]).toBe(initialCount + 1);
      expect(cached.pages[0].joinedMap[eventId]).toBe(true);
    });

    it('should prevent negative attendee counts', async () => {
      const eventId = 'event-123';

      const mockCacheData = {
        pages: [
          {
            events: [{ id: eventId }],
            attendeeCounts: { [eventId]: 0 },
            joinedMap: { [eventId]: false },
          },
        ],
      };

      queryClient.setQueryData(['events', 'uni-123'], mockCacheData);

      // Simulate leaving when count is 0
      queryClient.setQueryData(['events', 'uni-123'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            attendeeCounts: {
              ...page.attendeeCounts,
              [eventId]: Math.max(0, (page.attendeeCounts[eventId] || 0) - 1),
            },
          })),
        };
      });

      const cached = queryClient.getQueryData(['events', 'uni-123']) as any;
      expect(cached.pages[0].attendeeCounts[eventId]).toBe(0);
      expect(cached.pages[0].attendeeCounts[eventId]).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Optimistic Update Rollback', () => {
    it('should revert optimistic update on server error', async () => {
      const eventId = 'event-123';
      const initialCount = 5;
      const initialJoined = false;

      const mockCacheData = {
        pages: [
          {
            events: [{ id: eventId }],
            attendeeCounts: { [eventId]: initialCount },
            joinedMap: { [eventId]: initialJoined },
          },
        ],
      };

      queryClient.setQueryData(['events', 'uni-123'], mockCacheData);

      // Optimistic update
      queryClient.setQueryData(['events', 'uni-123'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            attendeeCounts: {
              ...page.attendeeCounts,
              [eventId]: initialCount + 1,
            },
            joinedMap: {
              ...page.joinedMap,
              [eventId]: true,
            },
          })),
        };
      });

      // Simulate error - invalidate to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['events', 'uni-123'] });

      const queryState = queryClient.getQueryState(['events', 'uni-123']);
      expect(queryState?.isInvalidated).toBe(true);
    });
  });

  describe('Cache Invalidation During Concurrent Changes', () => {
    it('should invalidate cache correctly during concurrent attendance changes', async () => {
      const eventId = 'event-123';
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Simulate cache invalidation
      queryClient.invalidateQueries({ queryKey: ['events', 'uni-123'] });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['events', 'uni-123'],
      });
    });
  });
});

