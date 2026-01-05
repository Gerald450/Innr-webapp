import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRelativeTime } from '@/utils/relativeTime';

describe('getRelativeTime', () => {
  beforeEach(() => {
    // Mock current time to have consistent tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for timestamps less than 1 minute ago', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const timestamp = new Date('2024-01-01T11:59:30Z');
    expect(getRelativeTime(timestamp)).toBe('just now');
  });

  it('should return minutes for timestamps less than 1 hour ago', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const timestamp30min = new Date('2024-01-01T11:30:00Z');
    expect(getRelativeTime(timestamp30min)).toBe('30m');

    const timestamp5min = new Date('2024-01-01T11:55:00Z');
    expect(getRelativeTime(timestamp5min)).toBe('5m');

    const timestamp1min = new Date('2024-01-01T11:59:00Z');
    expect(getRelativeTime(timestamp1min)).toBe('1m');
  });

  it('should return hours for timestamps less than 1 day ago', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const timestamp1hour = new Date('2024-01-01T11:00:00Z');
    expect(getRelativeTime(timestamp1hour)).toBe('1h');

    const timestamp5hours = new Date('2024-01-01T07:00:00Z');
    expect(getRelativeTime(timestamp5hours)).toBe('5h');

    const timestamp23hours = new Date('2023-12-31T13:00:00Z'); // 23 hours ago
    expect(getRelativeTime(timestamp23hours)).toBe('23h');
  });

  it('should return days for timestamps less than 1 week ago', () => {
    const now = new Date('2024-01-07T12:00:00Z');
    vi.setSystemTime(now);

    const timestamp1day = new Date('2024-01-06T12:00:00Z');
    expect(getRelativeTime(timestamp1day)).toBe('1d');

    const timestamp3days = new Date('2024-01-04T12:00:00Z');
    expect(getRelativeTime(timestamp3days)).toBe('3d');

    const timestamp6days = new Date('2024-01-01T12:00:00Z');
    expect(getRelativeTime(timestamp6days)).toBe('6d');
  });

  it('should return weeks for timestamps less than 1 month ago', () => {
    const now = new Date('2024-01-28T12:00:00Z');
    vi.setSystemTime(now);

    const timestamp1week = new Date('2024-01-21T12:00:00Z');
    expect(getRelativeTime(timestamp1week)).toBe('1w');

    const timestamp3weeks = new Date('2024-01-07T12:00:00Z');
    expect(getRelativeTime(timestamp3weeks)).toBe('3w');
  });

  it('should return months for timestamps less than 1 year ago', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    vi.setSystemTime(now);

    const timestamp1month = new Date('2024-05-01T12:00:00Z');
    expect(getRelativeTime(timestamp1month)).toBe('1mo');

    const timestamp5months = new Date('2024-01-01T12:00:00Z');
    expect(getRelativeTime(timestamp5months)).toBe('5mo');
  });

  it('should return years for timestamps 1 year or more ago', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const timestamp1year = new Date('2023-01-01T12:00:00Z');
    expect(getRelativeTime(timestamp1year)).toBe('1y');

    const timestamp2years = new Date('2022-01-01T12:00:00Z');
    expect(getRelativeTime(timestamp2years)).toBe('2y');
  });

  it('should handle ISO string timestamps', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const timestampString = '2024-01-01T11:30:00Z';
    expect(getRelativeTime(timestampString)).toBe('30m');
  });

  it('should handle edge case of exactly 1 hour', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    vi.setSystemTime(now);

    const timestamp = new Date('2024-01-01T11:00:00Z');
    expect(getRelativeTime(timestamp)).toBe('1h');
  });
});

