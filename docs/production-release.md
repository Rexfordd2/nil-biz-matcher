# Production Release Checklist - Persistence Hardening

- [ ] Supabase SQL applied (tables, RLS policies, functions)
- [ ] Auth site/redirect URLs set (Supabase Dashboard → Authentication → URL Configuration)
- [ ] Vercel env vars present in Production (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] Redeploy required (Vite env changes require a new build)
- [ ] Production persistence test steps:
  - [ ] Open app with `?debug=1` and confirm `Env configured: true`
  - [ ] Log in and confirm Health Check → Session: pass
  - [ ] Health Check → DB: pass (`athlete_profiles` accessible for current user)
  - [ ] Edit Athlete Profile and confirm status transitions: Loading → Saving → All changes saved
  - [ ] Refresh page and verify data is persisted from Supabase
  - [ ] Temporarily break credentials to validate error surfacing in debug panel (status/code/message)

