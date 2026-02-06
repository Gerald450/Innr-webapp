-- Fix: 409 Conflict when creating recurring events
--
-- The unique constraint on post_id prevents multiple events per post (required
-- for recurring events where parent + children share the same post_id).
--
-- Step 1: Drop unique constraint on post_id
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_post_id_key;

-- Step 2: Drop unique index if it exists (some setups use index instead of constraint)
DROP INDEX IF EXISTS events_post_id_key;

-- Step 3: Add INSERT RLS policy for events (allow users to create events for posts they authored)
-- Uses SECURITY DEFINER function to avoid infinite recursion (events policy -> posts -> events)
CREATE OR REPLACE FUNCTION public.can_insert_event_for_post(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts
    WHERE id = p_post_id AND author_id = auth.uid()
  );
$$;

CREATE POLICY "Allow event insert for post author"
ON public.events FOR INSERT
WITH CHECK (public.can_insert_event_for_post(post_id));

-- Step 4: Trigger verification note
-- The auto_create_recurring_instances trigger must only create CHILD events:
--   - parent_event_id = parent event's id (NOT null)
--   - is_recurring = FALSE
--   - Only parent events should have is_recurring = TRUE and parent_event_id = NULL
