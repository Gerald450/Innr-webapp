import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { usePosts } from '@/hooks/usePosts';
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

describe('usePosts', () => {
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

  it('should fetch and return posts with counts', async () => {
    const mockProfile = {
      university_id: 'uni-123',
    };

    const mockUser = {
      id: 'user-123',
    };

    const mockPostsData = [
      {
        id: 1,
        body: 'Post 1',
        created_at: '2024-01-01T12:00:00Z',
        author_id: 'author-1',
        post_type: 'text',
        profiles: {
          full_name: 'Author 1',
          graduation_year: 2024,
          avatar_url: 'https://example.com/avatar1.jpg',
        },
        post_media: [],
      },
    ];

    const mockLikesData = [{ post_id: 1 }, { post_id: 1 }]; // 2 likes
    const mockUserLikesData = [{ post_id: 1 }]; // user liked
    const mockCommentsData = [{ post_id: 1 }, { post_id: 1 }, { post_id: 1 }]; // 3 comments
    const mockRepostsData = [{ post_id: 1 }]; // 1 repost
    const mockUserRepostsData = []; // user not reposted
    const mockBookmarksData = [{ post_id: 1 }, { post_id: 1 }]; // 2 bookmarks
    const mockUserBookmarksData = [{ post_id: 1 }]; // user bookmarked

    // Mock useProfile
    vi.spyOn(useProfileHook, 'useProfile').mockReturnValue({
      data: mockProfile,
      isLoading: false,
      error: null,
    } as any);

    // Mock auth.getUser
    vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    // Mock posts query
    const mockPostsFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: mockPostsData,
        error: null,
      }),
    });

    // Mock likes queries
    const mockLikesFrom = vi
      .fn()
      .mockReturnValueOnce({
        // All likes
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: mockLikesData,
          error: null,
        }),
      })
      .mockReturnValueOnce({
        // User likes
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: mockUserLikesData,
          error: null,
        }),
      });

    // Mock comments query
    const mockCommentsFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: mockCommentsData,
        error: null,
      }),
    });

    // Mock reposts queries
    const mockRepostsFrom = vi
      .fn()
      .mockReturnValueOnce({
        // All reposts
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: mockRepostsData,
          error: null,
        }),
      })
      .mockReturnValueOnce({
        // User reposts
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: mockUserRepostsData,
          error: null,
        }),
      });

    // Mock bookmarks queries
    const mockBookmarksFrom = vi
      .fn()
      .mockReturnValueOnce({
        // All bookmarks
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: mockBookmarksData,
          error: null,
        }),
      })
      .mockReturnValueOnce({
        // User bookmarks
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: mockUserBookmarksData,
          error: null,
        }),
      });

    // Mock from() calls
    vi.spyOn(supabaseClient.supabase, 'from')
      .mockReturnValueOnce(mockPostsFrom() as any) // posts
      .mockReturnValueOnce(mockLikesFrom() as any) // post_likes (all)
      .mockReturnValueOnce(mockLikesFrom() as any) // post_likes (user)
      .mockReturnValueOnce(mockCommentsFrom() as any) // comments
      .mockReturnValueOnce(mockRepostsFrom() as any) // reposts (all)
      .mockReturnValueOnce(mockRepostsFrom() as any) // reposts (user)
      .mockReturnValueOnce(mockBookmarksFrom() as any) // bookmarks (all)
      .mockReturnValueOnce(mockBookmarksFrom() as any); // bookmarks (user)

    const { result } = renderHook(() => usePosts(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBe(1);
    
    const post = result.current.data?.[0];
    expect(post?.id).toBe(1);
    expect(post?.likeCount).toBe(2);
    expect(post?.isLiked).toBe(true);
    expect(post?.commentCount).toBe(3);
    expect(post?.repostCount).toBe(1);
    expect(post?.isReposted).toBe(false);
    expect(post?.bookmarkCount).toBe(2);
    expect(post?.isBookmarked).toBe(true);
  });

  it('should handle missing university_id', () => {
    vi.spyOn(useProfileHook, 'useProfile').mockReturnValue({
      data: { university_id: null },
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(() => usePosts(), { wrapper });

    // Query should be disabled when university_id is missing, so it won't execute
    expect(result.current.isFetching).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('should handle authentication error', async () => {
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

    const { result } = renderHook(() => usePosts(), { wrapper });

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

    const { result } = renderHook(() => usePosts(), { wrapper });

    // Should not be enabled when profile is loading
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle empty posts', async () => {
    const mockProfile = {
      university_id: 'uni-123',
    };

    const mockUser = {
      id: 'user-123',
    };

    vi.spyOn(useProfileHook, 'useProfile').mockReturnValue({
      data: mockProfile,
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    // Mock empty posts
    const mockPostsFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockPostsFrom() as any);

    const { result } = renderHook(() => usePosts(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});

