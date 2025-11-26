### MEDIUM
- Improve importer error handling: check `res.ok`, handle timeouts, surface specific messages (e.g., 404, CORS, network).
- Add better error messaging for Yelp provider (e.g., distinguish 401 unauthorized vs 429 rate limit).
- Validate numeric inputs (followers, hours/week) to prevent `NaN` on malformed input.
- Add `.env.example` and README section for `VITE_BUSINESS_SEARCH_PROVIDER`, `VITE_YELP_API_KEY`, `VITE_YELP_PROXY_URL`.
- Add `.gitignore` entry for `dist/` (and ensure build artifacts are not committed).

### LOW
- Tighten legacy migrations: remove `any` usage by defining a narrow input type or runtime validators.
- Debounce business search input to reduce API calls as the user types.
- Add unit tests for `evaluateMatch` and `autoAnalyzeBusiness` heuristics.
- Consider caching search results client-side to reduce repeated external requests.
- Expand `importBusinessFromUrl` canonicalization for URLs (strip tracking params, normalize host).


