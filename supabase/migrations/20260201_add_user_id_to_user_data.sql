-- Add user_id column to user_data table for authenticated user tracking
-- This allows both authenticated users (user_id) and anonymous users (anon_id) to be tracked

-- Add user_id column (nullable to support existing anon-only records)
ALTER TABLE public.user_data 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index on user_id for query performance
CREATE INDEX IF NOT EXISTS user_data_user_id_idx ON public.user_data(user_id);

-- Add index on data_type for filtering
CREATE INDEX IF NOT EXISTS user_data_data_type_idx ON public.user_data(data_type);

-- Add composite index for authenticated user queries
CREATE INDEX IF NOT EXISTS user_data_user_id_data_type_idx ON public.user_data(user_id, data_type) WHERE user_id IS NOT NULL;

-- Update RLS policies to allow authenticated users to read their own data
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to user_data" ON public.user_data;
DROP POLICY IF EXISTS "Allow public insert to user_data" ON public.user_data;

-- Create new RLS policies
-- Allow authenticated users to read their own user_id records
CREATE POLICY "Users can read their own user_data"
ON public.user_data
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow authenticated users to insert their own records
CREATE POLICY "Users can insert their own user_data"
ON public.user_data
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow anonymous users to insert with anon_id (no user_id)
CREATE POLICY "Anonymous users can insert with anon_id"
ON public.user_data
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL AND anon_id IS NOT NULL);

-- Note: We keep anon_id for backward compatibility and anonymous tracking
-- The app logic will use user_id when authenticated, anon_id when not
