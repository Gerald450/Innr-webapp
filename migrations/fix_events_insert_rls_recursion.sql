-- Fix: "infinite recursion detected in policy for relation events" on INSERT
--
-- The INSERT policy queried public.posts. If posts has RLS that references events
-- (e.g., via foreign keys or policies), evaluating the events INSERT policy
-- triggers a read of posts, which triggers events, which triggers posts... → recursion.
--
-- Solution: Use a SECURITY DEFINER function to check post authorship. The function
-- runs with owner privileges and bypasses RLS when reading posts, breaking the cycle.

DROP POLICY IF EXISTS "Allow event insert for post author" ON public.events;

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
