-- Migration: Add status column to follows table for connection requests
-- This enables private profile functionality where users must accept connection requests

-- Step 1: Add status column with default 'accepted' for backward compatibility
ALTER TABLE follows 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted';

-- Step 2: Update all existing rows to 'accepted' status
UPDATE follows 
SET status = 'accepted' 
WHERE status IS NULL;

-- Step 3: Add check constraint to ensure status is one of the valid values
ALTER TABLE follows 
ADD CONSTRAINT follows_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected'));

-- Step 4: Create index for better query performance on status checks
CREATE INDEX IF NOT EXISTS idx_follows_status ON follows(status);
CREATE INDEX IF NOT EXISTS idx_follows_follower_status ON follows(follower_id, status);
CREATE INDEX IF NOT EXISTS idx_follows_following_status ON follows(following_id, status);

-- Step 5: Add comment for documentation
COMMENT ON COLUMN follows.status IS 'Connection status: pending (request sent), accepted (connected), rejected (request declined)';
