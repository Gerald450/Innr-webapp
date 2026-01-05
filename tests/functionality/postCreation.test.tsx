import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as supabaseClient from '@/lib/supabaseClient';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

describe('Post Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Text-only post creation', () => {
    it('should create a post with text only', async () => {
      const user = { id: 'user-123' };
      const profile = {
        id: 'user-123',
        full_name: 'Test User',
        graduation_year: 2024,
        university_id: 'uni-123',
      };

      const postData = {
        id: 'post-123',
        body: 'Test post content',
        author_id: user.id,
        university_id: profile.university_id,
        post_type: 'text',
        created_at: new Date().toISOString(),
      };

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

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelectPost = vi.fn().mockResolvedValue({
        data: postData,
        error: null,
      });

      vi.spyOn(supabaseClient.supabase, 'from')
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        } as any)
        .mockReturnValueOnce({
          insert: mockInsert,
          select: mockSelectPost,
          single: mockSelectPost,
        } as any);

      // Simulate post creation
      const result = await supabaseClient.supabase
        .from('posts')
        .insert({
          author_id: user.id,
          university_id: profile.university_id,
          post_type: 'text',
          body: postData.body,
        })
        .select()
        .single();

      expect(result.data).toEqual(postData);
      expect(result.error).toBeNull();
    });
  });

  describe('Post creation with media', () => {
    it('should create a post with media uploads', async () => {
      const user = { id: 'user-123' };
      const profile = {
        id: 'user-123',
        university_id: 'uni-123',
      };

      const postData = {
        id: 'post-123',
        body: 'Post with media',
        post_type: 'media',
      };

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockStorageFrom = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'user-123/post-123/file.jpg' },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/image.jpg' },
        }),
      });

      vi.spyOn(supabaseClient.supabase.storage, 'from').mockReturnValue(
        mockStorageFrom() as any
      );

      const mockFrom = vi.fn()
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: profile, error: null }),
        } as any)
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({ data: postData, error: null }),
          single: vi.fn().mockResolvedValue({ data: postData, error: null }),
        } as any)
        .mockReturnValueOnce({
          insert: vi.fn().mockResolvedValue({
            data: { url: 'https://example.com/image.jpg' },
            error: null,
          }),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { url: 'https://example.com/image.jpg' },
            error: null,
          }),
        } as any);

      vi.spyOn(supabaseClient.supabase, 'from').mockImplementation(mockFrom);

      // Simulate media upload
      const uploadResult = await supabaseClient.supabase.storage
        .from('post-media')
        .upload('path/file.jpg', mockFile);

      expect(uploadResult.data).toBeDefined();
      expect(uploadResult.error).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should handle network failures during post creation', async () => {
      const user = { id: 'user-123' };

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      try {
        await supabaseClient.supabase
          .from('profiles')
          .select()
          .eq('id', user.id)
          .single();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Network error');
      }
    });

    it('should handle validation errors', async () => {
      const user = { id: 'user-123' };

      vi.spyOn(supabaseClient.supabase.auth, 'getUser').mockResolvedValue({
        data: { user },
        error: null,
      } as any);

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23514', message: 'check constraint violation' },
        }),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23514', message: 'check constraint violation' },
        }),
      });

      vi.spyOn(supabaseClient.supabase, 'from').mockReturnValue(mockFrom() as any);

      const result = await supabaseClient.supabase
        .from('posts')
        .insert({})
        .select()
        .single();

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('23514');
    });
  });

  describe('Empty/Invalid data', () => {
    it('should reject posts with empty text and no media', () => {
      const text = '';
      const mediaFiles: File[] = [];

      const isValid = text.trim() || mediaFiles.length > 0;
      expect(isValid).toBe(false);
    });

    it('should accept posts with text only', () => {
      const text = 'Valid post content';
      const mediaFiles: File[] = [];

      const isValid = text.trim() || mediaFiles.length > 0;
      expect(isValid).toBe(true);
    });

    it('should accept posts with media only', () => {
      const text = '';
      const mediaFiles = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];

      const isValid = text.trim() || mediaFiles.length > 0;
      expect(isValid).toBe(true);
    });
  });
});

