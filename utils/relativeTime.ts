/**
 * Calculates and returns a human-readable relative time string
 * @param timestamp - ISO timestamp string or Date object
 * @returns Relative time string (e.g., "5m", "2h", "3d")
 */
export function getRelativeTime(timestamp: string | Date): string {
  const now = new Date();
  const past = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  
  const diffInMs = now.getTime() - past.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInWeeks = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7));
  const diffInMonths = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30));
  const diffInYears = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 365));

  // If less than 1 hour, show in minutes
  if (diffInHours < 1) {
    if (diffInMinutes < 1) {
      return "just now";
    }
    return `${diffInMinutes}m`;
  }

  // If 1 hour or more, show in hours (rounded to nearest hour)
  if (diffInDays < 1) {
    return `${diffInHours}h`;
  }

  // If 1 day or more, show in days
  if (diffInWeeks < 1) {
    return `${diffInDays}d`;
  }

  // If 1 week or more, show in weeks
  if (diffInMonths < 1) {
    return `${diffInWeeks}w`;
  }

  // If 1 month or more, show in months
  if (diffInYears < 1) {
    return `${diffInMonths}mo`;
  }

  // If 1 year or more, show in years
  return `${diffInYears}y`;
}

