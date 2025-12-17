## Persistence Verification Checklist

Use this to verify autosave + reload works locally and on the deployed Vercel URL.

Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for your project in `.env.local`. Do not commit `.env.local` (it is gitignored).
3. In Vercel, set the same variables in the Environment Variables for Production (and Preview if needed).

1. Sign up or log in
   - If using Supabase auth screens, confirm login succeeds.
2. Edit Athlete Profile fields
   - Change name, sport, and a social handle.
   - Observe the status in the Athlete tab header: it should show “Saving…” then “All changes saved”.
3. Hard refresh the page
   - The same values should load from Supabase and repopulate the form.
4. Log out and log in again
   - After re-auth, the profile loads from Supabase with previous changes.
5. Deploy to Vercel and repeat at the production URL
   - Ensure Vercel project has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured in Production.
   - Header should show “Cloud sync: Available”.
6. Supabase table verification
   - In the Supabase dashboard, open `athlete_profiles`.
   - Confirm a row exists for your `user_id` and the `profile` JSON contains your edits.
7. Debug panel (optional)
   - Append `?debug=1` to the URL to reveal the debug panel.
   - Check current user id, last saved time, any error message; click “Force reload from Supabase” to re-fetch.

