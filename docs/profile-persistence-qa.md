## Athlete Profile Persistence & Public Profile QA

Run through this checklist to verify that the athlete profile persists fully and the Public Profile renders from the same single source of truth (Supabase JSONB or local draft when offline).

- Saving end-to-end
  - Edit fields across all major sections in the Athlete tab:
    - Profile basics: name, school, level, sports, location
    - Socials: multiple social handles, followers
    - Brand/Story: content styles, personality, values, media kit (hero images, logos, brand colors, sample posts, external link)
    - Contacts: support team and decision circle
    - Academics & Availability
    - Recruiting Profile: physical attributes, sport metrics, game film
    - Training Log entries
    - NIL compliance (email, policy URL, collective details)
  - Click “Save Profile”
  - Status shows “Saving…” then “All changes saved” (or error if applicable)
  - Refresh the page
  - All edits appear exactly as entered after refresh

- Public Profile sync
  - Navigate to “Public Profile”
  - The page renders from the same persisted profile (Supabase `athlete_profiles.profile` when logged in)
  - Verify key sections render updated values:
    - Profile header: name, sports + positions, school, level, location
    - Socials (all handles)
    - Recruiting snapshot: physical attributes, top metrics, game film
    - What I’m looking for (monetization interests)
    - Brand & Story (performance story: milestones, current focus, future goals)
    - Contacts (support team and decision circle)
    - Academics & Availability
    - Compliance & NIL
    - Media Kit (hero images, logos, brand colors, sample posts, external deck link)
    - Training Log (recent entries)

- Edge cases
  - Log in → open “Public Profile” directly without visiting “Athlete”
    - Public Profile should still show the remote profile (Supabase) as the source of truth
  - Make additional edits in “Athlete”, save, and immediately view “Public Profile”
    - Changes should appear without requiring a page reload
  - Offline / Supabase not configured
    - Saving should fall back to local draft and status should display “Cloud sync unavailable”

If any section fails, capture the field name, expected vs. actual values, and whether it appears in the `athlete_profiles.profile` JSON in Supabase.
# Athlete Profile Persistence & Public Profile QA

## Preconditions
- Logged in with a Supabase-backed user (cloud sync available).
- `athlete_profiles.profile` row exists (auto-upsert will create if missing).

## Steps

1) Edit and persist across all sections
- Athlete Profile → edit fields across:
  - Profile basics: name, school, level, sports (add a second sport + positions), location
  - Social: add multiple social handles (with URLs), followers
  - Content: content styles, personality, values
  - Support & Decision Circle: add 1–2 entries to each
  - Academics & Life: schoolName, level, GPA range, interests, advisor contact
  - Availability: add 1–2 windows, mark days and time ranges; toggle International flag
  - Performance Story: add milestones (one per line), current focus, future goals
  - Training Log: add 2–3 entries with date/type/description/duration/intensity
  - Monetization Interests: select multiple tags
  - Media Kit: add hero images, logos, brand colors, sample posts, external deck link
  - NIL/Compliance: email, policy URL, associated collective (name, contact, notes)
- Click “Save Profile”
  - Verify status: “Saving…” then “All changes saved”
  - No error output in the status line
- Refresh the page
  - All edited fields rehydrate exactly as entered

2) Debounced autosave
- Modify a few fields (e.g., values, content styles, one support team contact)
- Wait for autosave to trigger (status changes to “Saving…” → “All changes saved”)
- Refresh
  - Changes persist

3) Public Profile rendering
- Navigate to “Public Profile”
- Verify it reads the same profile object and renders:
  - Profile basics: name, sports/positions, school, level, location
  - Social: list of social accounts with optional links
  - Recruiting Snapshot: physical attributes, 5 metrics, game film links
  - What I’m looking for: monetization interests
  - Brand & Story: performance story (milestones, current focus, future goals)
  - Contacts & Decision Circle: support team + decision circle
  - Academics & Availability: school/level/GPA/interests + availability windows + international flag
  - Compliance & NIL: email, policy link, associated collective
  - Media Kit: hero images/logos/colors/sample posts/external deck
  - Training Log: 5 most recent entries

4) Live edits reflect in Preview
- While on “Athlete Profile”, edit a visible field (e.g., add a support contact or change “values”)
- Navigate to “Public Profile”
  - The changes appear (uses live state first; falls back to cloud)

5) Error handling (optional)
- Temporarily break connectivity to Supabase
  - Status shows “Cloud sync unavailable” or an error string with status/code/message
  - Local changes stored in localStorage draft
  - After connectivity is back, saving resumes and status returns to “All changes saved”

## Expected Results
- Every field modified is persisted in a single JSON payload at `athlete_profiles.profile`.
- “Save Profile” flushes pending debounced changes immediately.
- Status line shows Saving… / All changes saved / Error as applicable.
- Public Profile renders exactly what is saved (same object), across all sections.

# Profile Persistence & Public Profile QA

## Preconditions
- Supabase env configured (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Logged-in user.

## Athlete Profile save
1. Open Athlete tab.
2. Edit these fields, then click Save Profile:
   - Name, School, Level
   - Add Sports and Positions (multi)
   - Location
   - Social Handles (add 2+ with URLs), Followers
   - Content Styles (toggle several)
   - Personality, Values
   - Time capacity, Professionalism
   - Media Kit: add hero image URL, a logo URL, a brand color, a sample post line, and an external deck URL
   - Support Team: add an entry
   - Decision Circle: add an entry
   - Academics: fill fields and interests
   - Availability: add a window and toggle days, time range; toggle International flag
   - Performance Story: add milestones, current focus, and future goals
   - Training Log: add 1–2 entries with minutes and intensity
   - Monetization Interests: pick several
   - Recruiting Profile: Physical attributes (height ft/in, weight), dominant hand; add 2 metrics; add 2 game film links
   - NIL: compliance email, policy URL; collective name, contact, email, notes
3. Observe status text shows “Saving…” then “All changes saved”.
4. Refresh the page.
5. Revisit Athlete tab; verify ALL fields are restored exactly.

## Public Profile
1. Navigate to Public Profile tab.
2. Verify sections reflect the saved profile:
   - Profile (name, sports/positions, school/level, location, socials with links)
   - Recruiting Snapshot (physical, metrics, game film)
   - What I’m looking for (monetization interests)
   - Brand & Story (milestones, current focus, future goals)
   - Contacts & Decision Circle (support team, trusted circle)
   - Academics & Availability (school/level/GPA/interests; availability windows; international flag)
   - Compliance & NIL (compliance email, policy, collective)
   - Media Kit (thumbnails or lists of assets)
   - Training Log (recent entries)

## Autosave & Save Now
1. Make small edits and wait; ensure autosave persists changes.
2. Click Save Profile; confirm immediate save (no delay) and status updates.

## Error handling (optional)
1. Temporarily break env or network to force an error.
2. Ensure status shows “Couldn’t save. Will retry.” and resumes on recovery.


