import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useProfile } from '@/hooks/useProfile';
import * as supabaseClient from '@/lib/supabaseClient';
import * as storage from '@/utils/storage';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock storage utilities
vi.mock('@/utils/storage', () => ({
  getCachedProfile: vi.fn(),
  setCachedProfile: vi.fn(),
  setCachedUniversityId: vi.fn(),
  setCachedUserRole: vi.fn(),
}));

describe('useProfile', () => {
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
    // Clear query cache
    queryClient.clear();
  });

  it('should fetch and return profile data', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    const mockProfile = {
      id: 'user-123',
      full_name: 'Test User',
      username: 'testuser',
      graduation_year: 2024,
      avatar_url: 'https://example.com/avatar.jpg',
      role: 'admin',
      university_id: 'uni-123',
    };

    // Mock Supabase auth.getUser
    vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    // Mock Supabase from().select().eq().single()
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockProfile,
      error: null,
    });

    vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    } as any);

    // Mock storage
    vi.spyOn(storage, 'getCachedProfile').mockReturnValue(null);
    vi.spyOn(storage, 'setCachedProfile').mockImplementation(() => {});
    vi.spyOn(storage, 'setCachedUniversityId').mockImplementation(() => {});
    vi.spyOn(storage, 'setCachedUserRole').mockImplementation(() => {});

    const { result } = renderHook(() => useProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockProfile);
    expect(storage.setCachedProfile).toHaveBeenCalledWith(mockProfile);
    expect(storage.setCachedUniversityId).toHaveBeenCalledWith('uni-123');
    expect(storage.setCachedUserRole).toHaveBeenCalledWith('admin');
  });

  it('should use cached profile as placeholder data', () => {
    const mockCachedProfile = {
      id: 'user-123',
      full_name: 'Cached User',
      username: 'cacheduser',
    };

    vi.spyOn(storage, 'getCachedProfile').mockReturnValue(mockCachedProfile as any);
    vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockCachedProfile,
      error: null,
    });

    vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    } as any);

    const { result } = renderHook(() => useProfile(), { wrapper });

    // Should use cached profile as placeholder
    expect(result.current.data).toEqual(mockCachedProfile);
  });

  it('should handle authentication error', async () => {
    vi.spyOn(storage, 'getCachedProfile').mockReturnValue(null);
    vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    } as any);

    const { result } = renderHook(() => useProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should handle profile not found error (PGRST116)', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    vi.spyOn(storage, 'getCachedProfile').mockReturnValue(null);
    vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows returned' },
    });

    vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    } as any);

    const { result } = renderHook(() => useProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should return null for not found, not throw error
    expect(result.current.data).toBeNull();
  });

  it('should not retry on authentication errors', async () => {
    vi.spyOn(storage, 'getCachedProfile').mockReturnValue(null);
    vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    } as any);

    const { result } = renderHook(() => useProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Should not retry
    expect(supabaseClient.supabase.auth.getUser).toHaveBeenCalledTimes(1);
  });
});

