-- Update waitlist table schema for production readiness
-- Safe to run multiple times due to IF NOT EXISTS and IF EXISTS guards

-- Add anon_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'waitlist' 
    AND column_name = 'anon_id'
  ) THEN
    ALTER TABLE public.waitlist ADD COLUMN anon_id text;
  END IF;
END $$;

-- Drop the old case-sensitive unique index
DROP INDEX IF EXISTS idx_waitlist_email_unique;

-- Create case-insensitive unique index on email (safer than normalizing in app layer)
-- This prevents duplicates like "user@example.com" and "User@Example.com"
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_lower_unique 
  ON public.waitlist(lower(email));

-- Add index on created_at if not exists (for reporting/analytics)
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at 
  ON public.waitlist(created_at);

-- Add index on anon_id for lookups (optional but helpful)
CREATE INDEX IF NOT EXISTS idx_waitlist_anon_id 
  ON public.waitlist(anon_id) 
  WHERE anon_id IS NOT NULL;

-- Ensure RLS is enabled
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Allow anonymous waitlist inserts" ON public.waitlist;
DROP POLICY IF EXISTS "Allow authenticated waitlist inserts" ON public.waitlist;
DROP POLICY IF EXISTS "Allow authenticated waitlist reads" ON public.waitlist;
DROP POLICY IF EXISTS "Deny anonymous selects" ON public.waitlist;
DROP POLICY IF EXISTS "Deny anonymous updates" ON public.waitlist;
DROP POLICY IF EXISTS "Deny anonymous deletes" ON public.waitlist;

-- Policy: Allow anonymous inserts ONLY (for public waitlist signup)
CREATE POLICY "Allow anonymous waitlist inserts"
  ON public.waitlist
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Allow authenticated users to insert (for admin/backfill purposes)
CREATE POLICY "Allow authenticated waitlist inserts"
  ON public.waitlist
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users can read (for admin purposes)
CREATE POLICY "Allow authenticated waitlist reads"
  ON public.waitlist
  FOR SELECT
  TO authenticated
  USING (true);

-- Explicitly deny anonymous selects, updates, and deletes
CREATE POLICY "Deny anonymous selects"
  ON public.waitlist
  FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "Deny anonymous updates"
  ON public.waitlist
  FOR UPDATE
  TO anon
  USING (false);

CREATE POLICY "Deny anonymous deletes"
  ON public.waitlist
  FOR DELETE
  TO anon
  USING (false);
