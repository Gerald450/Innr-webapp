-- Fix: "infinite recursion detected in policy for relation events"
--
-- The previous "Events viewable with post" policy referenced public.events
-- in a subquery (to check parent_event_id). Evaluating the policy on events
-- triggered the same policy when reading from events → infinite recursion.
--
-- Solution: Use only the posts check. Child/exception events also have post_id
-- (copied from parent), so they are covered. No need to query events inside
-- the events policy.

DROP POLICY IF EXISTS "Events viewable with post" ON public.events;

CREATE POLICY "Events viewable with post"
ON public.events FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.posts WHERE id = events.post_id)
);
