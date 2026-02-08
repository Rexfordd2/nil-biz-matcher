-- Create search cache table for persistent caching of Google Places API results
-- Reduces upstream API calls and improves reliability

CREATE TABLE IF NOT EXISTS public.search_cache (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on created_at for efficient TTL cleanup
CREATE INDEX IF NOT EXISTS idx_search_cache_created_at ON public.search_cache(created_at);

-- Enable Row Level Security
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to read/write (server-side only)
-- No public access needed - this is purely server-side cache
CREATE POLICY "Service role can manage search cache"
  ON public.search_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.search_cache IS 'Persistent cache for Google Places API search results. TTL: 10 minutes. Server-side only.';
