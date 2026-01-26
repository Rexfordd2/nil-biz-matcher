## Saved Businesses - QA Checklist

Prereqs:
- Supabase configured (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and a logged-in session.
- Run the SQL in `supabase/saved_businesses.sql` on your Supabase project.

Steps:
1) Load Discover tab. Ensure Google search works (see `docs/discover-qa.md`).
2) Select a result and open the details panel.
3) Click "Save".
   - Button shows "Saving…" then "Saved".
   - No error toast/console error.
4) Click "Save" again on the same item.
   - State remains "Saved" (duplicate handled gracefully).
5) Scroll to "Saved Businesses" section.
   - The saved item appears with name and address, newest at top.
   - Website link opens in a new tab when present.
6) Click "Remove" on a saved item.
   - It disappears from the list.
7) Reload the page.
   - Saved items persist and re-appear for the same logged-in user.
8) Log out (or ensure no Supabase session) and retry Save.
   - Save is disabled (no session), or shows no effect.
9) Build: `npm run build` should pass.


