# Recruiting Explore + Targets QA

## Setup
- Ensure `.env.local` contains a valid `VITE_GOOGLE_MAPS_API_KEY` for map-based search features.
- For detailed setup instructions, see: [docs/google-maps-setup.md](./google-maps-setup.md)
- Restart dev server after changing environment variables.

## Explore (Map)
- Refresh results can be clicked repeatedly without locking the UI.
- While loading, the button shows “Searching…” and is disabled; it re-enables on completion or error.
- Errors are readable strings (no “[object Object]”).
- No page reload occurs when pressing “Refresh results”.
- No overlapping/stale results flicker; last refresh wins.

## Filters
- Org Type options exclude “team” and “facility”; include “other”.
- Sport list includes additional sports (mma, equestrian, shooting, weightlifting, etc.).
- Selecting “Other” under Sport reveals a custom input and searches using that value.

## Targets Persistence
- Save 2 orgs from Explore → “My Targets” shows both.
- Recruiting Board shows the same targets grouped by status.
- Recruiting Blast recipients list shows contacts from those targets’ orgs.

## Basic Flows
- Update a target’s status in Board → reflects after reload.
- Send Blast to selected recipients from My Targets → succeeds or shows a helpful error if SMTP not configured.


