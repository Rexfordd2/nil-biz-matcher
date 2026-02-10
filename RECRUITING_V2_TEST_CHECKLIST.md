# Recruiting V2 - Manual Test Checklist

This checklist covers the key functionality of the new Recruiting V2 system.

## Routing Tests

- [ ] Navigate to `/recruiting` - should load V2 interface
  - [ ] Verify "RECRUITING UI V2 ACTIVE" label is visible
  - [ ] Verify "Open Legacy UI" button is present in header
- [ ] Navigate to `/recruiting/legacy` - should load legacy (V1) interface
  - [ ] Verify "RECRUITING UI v1 ACTIVE" label is visible
  - [ ] Verify tabs show "Explore" and "My Targets"
- [ ] In-app: Click "Recruiting (V2)" in sidebar - should open V2 tab
  - [ ] Verify tab renders correctly within App.tsx
  - [ ] Verify V2 interface is displayed

## Search Functionality

### Search with Query Only (No Location)
- [ ] Select "soccer" from Sport dropdown
- [ ] Leave Location empty
- [ ] Click "Search"
- [ ] Verify results are returned
- [ ] Verify no location-blocking error occurs

### Search with Query + Location
- [ ] Select "basketball" from Sport dropdown
- [ ] Enter "Los Angeles, CA" in Location field
- [ ] Click "Apply" for location
- [ ] Verify green checkmark shows "✓ Location: Los Angeles, CA"
- [ ] Select radius (e.g., 25 miles)
- [ ] Click "Search"
- [ ] Verify results are returned
- [ ] Verify results are relevant to location

### Bad Location Handling
- [ ] Select "football" from Sport dropdown
- [ ] Enter gibberish in Location field (e.g., "asdfasdfasdf")
- [ ] Click "Apply" for location
- [ ] Click "Search"
- [ ] Verify search still executes (doesn't block)
- [ ] Verify results are returned (text-only search fallback)

### Network Error Handling
- [ ] Disconnect network or use browser DevTools to throttle to "Offline"
- [ ] Attempt a search
- [ ] Verify user-friendly error message is displayed
- [ ] Verify "Retry" button appears
- [ ] Reconnect network
- [ ] Click "Retry"
- [ ] Verify search succeeds

### Stale Results Resilience
- [ ] Perform a successful search
- [ ] Note the results
- [ ] Trigger a retryable error (e.g., rate limit if possible, or manually test)
- [ ] Verify last known good results are still displayed
- [ ] Verify amber warning banner shows "⚠️ [error message] (Showing last known good results)"
- [ ] Verify "Retry" button is available

## Shortlist (Star) Functionality

### Add to Shortlist
- [ ] Search for results
- [ ] Click the star (☆) icon on a result
- [ ] Verify star becomes filled (⭐)
- [ ] Verify result moves to top of list (starred results sort first)
- [ ] Verify a status badge appears on the result (e.g., "Shortlisted")

### Shortlist Persistence
- [ ] Star 2-3 different results
- [ ] Refresh the page (F5)
- [ ] Navigate back to Recruiting V2
- [ ] Verify all starred results remain starred
- [ ] Verify results are still sorted with starred items first

### Remove from Shortlist
- [ ] Click the star (⭐) on a starred result
- [ ] Verify star becomes empty (☆)
- [ ] Verify result re-sorts to alphabetical position
- [ ] Verify status badge is removed or updated

## Contact Tracking

### Select a Contact
- [ ] Star a result to add it to shortlist
- [ ] Click on the result in the middle panel
- [ ] Verify right panel shows contact details
- [ ] Verify place name and address are displayed
- [ ] Verify website and phone (if available) are shown

### Status Tracking
- [ ] Select a starred contact
- [ ] Change status dropdown (e.g., from "Shortlisted" to "Contacted")
- [ ] Verify status updates immediately
- [ ] Refresh page
- [ ] Verify status persists after refresh
- [ ] Verify status badge on result reflects the change

### Last Contacted Date
- [ ] Select a starred contact
- [ ] Click "Today" button next to Last Contacted field
- [ ] Verify date is set to today
- [ ] Verify status changes to "Contacted" (if it was "New" or "Shortlisted")
- [ ] Verify a green badge appears on the result showing "Contacted [date]"
- [ ] Change date manually using date picker
- [ ] Verify date updates
- [ ] Refresh page
- [ ] Verify date persists

### Notes
- [ ] Select a starred contact
- [ ] Type notes in the Notes textarea (e.g., "Great program, emailed coach on 1/15")
- [ ] Click outside the textarea (blur event)
- [ ] Verify "Auto-saves on blur" message is visible
- [ ] Refresh page
- [ ] Select same contact
- [ ] Verify notes are persisted and displayed

## Outreach Templates

### View Templates
- [ ] Select any contact
- [ ] Click "Show" button in Outreach Templates section
- [ ] Verify 4 templates are displayed:
  - [ ] Initial Introduction
  - [ ] Follow-Up
  - [ ] Share Highlight Video
  - [ ] Camp/Showcase Interest

### Copy Template
- [ ] Click "Copy" on "Initial Introduction" template
- [ ] Verify alert/notification appears: "Template copied to clipboard!"
- [ ] Paste into a text editor (Ctrl+V or Cmd+V)
- [ ] Verify full message is copied with subject and body
- [ ] Verify placeholders are present (e.g., `{orgName}`, `{athleteName}`)
- [ ] Repeat for at least one other template

## CSV Export

### Export Empty Shortlist
- [ ] Remove all starred contacts (or start fresh)
- [ ] In right panel, verify shortlist count shows "0 contacts saved"
- [ ] Click "Export CSV" button (if visible with 0 contacts)
- [ ] Verify alert shows "No contacts in shortlist to export"

### Export Shortlist
- [ ] Star 3-5 different results
- [ ] Set different statuses (e.g., Shortlisted, Contacted, FollowUp)
- [ ] Add notes to at least 2 contacts
- [ ] Set "Last Contacted" date on at least 1 contact
- [ ] Click "Export Shortlist CSV" button
- [ ] Verify CSV file downloads with filename format: `recruiting-shortlist-YYYY-MM-DD.csv`
- [ ] Open CSV file in Excel or text editor
- [ ] Verify columns include:
  - [ ] name
  - [ ] address
  - [ ] status
  - [ ] notes
  - [ ] last_contacted
  - [ ] created_at
  - [ ] location (lat,lng)
- [ ] Verify data is correct for all exported contacts

## Filter Functionality

### Sport Filter
- [ ] Select different sports from dropdown
- [ ] Verify "other" option shows text input for custom sport
- [ ] Enter custom sport and search
- [ ] Verify results are relevant

### Level Filter
- [ ] Select different levels (youth, hs, college, etc.)
- [ ] Search with level only
- [ ] Verify results include level-appropriate organizations

### Org Type Filter
- [ ] Select different org types (school, club, league, etc.)
- [ ] Search with org type only
- [ ] Verify results match org type

### Clear Filters
- [ ] Set multiple filters
- [ ] Click "Clear" button
- [ ] Verify all filters reset to empty/default
- [ ] Verify location is cleared

## UI/UX Tests

### Responsive Layout
- [ ] Resize browser to desktop width (>1024px)
- [ ] Verify 3-column layout displays properly
- [ ] Resize to tablet width (768-1024px)
- [ ] Verify layout adapts appropriately
- [ ] Resize to mobile width (<768px)
- [ ] Verify layout stacks or adjusts for mobile

### Loading States
- [ ] Trigger a search
- [ ] Verify "Searching..." button text appears
- [ ] Verify button is disabled during search
- [ ] Verify results panel shows "Searching..." message

### Empty States
- [ ] Clear all filters
- [ ] Verify "Select at least one filter..." message appears
- [ ] Perform search with no results
- [ ] Verify "No results yet..." message appears
- [ ] Select contact panel with no selection
- [ ] Verify "Select a result..." message with pointing hand appears

### Disabled States
- [ ] If Google Maps API key is not configured:
  - [ ] Verify GoogleMapsDisabledNotice appears
  - [ ] Verify Search button is disabled
  - [ ] Verify appropriate message is shown

## Integration Tests

### Navigate Between V2 and Legacy
- [ ] Start in V2 at `/recruiting`
- [ ] Click "Open Legacy UI" button
- [ ] Verify navigation to `/recruiting/legacy`
- [ ] Verify legacy UI loads correctly
- [ ] Navigate back to `/recruiting`
- [ ] Verify V2 loads correctly
- [ ] Verify starred contacts from V2 are preserved (localStorage is shared if using same keys, or separate if using different storage)

### Cross-Session Persistence
- [ ] Star 2-3 contacts
- [ ] Add notes and status to each
- [ ] Close browser tab completely
- [ ] Open new browser tab
- [ ] Navigate to `/recruiting`
- [ ] Verify all starred contacts are still present
- [ ] Verify notes and statuses are preserved

## Edge Cases

### Rapid Clicking
- [ ] Click Search button rapidly multiple times
- [ ] Verify only one request is executed (single-flight enforcement)
- [ ] Verify no duplicate results or race conditions

### Special Characters in Location
- [ ] Enter location with special characters (e.g., "São Paulo, Brazil")
- [ ] Verify search handles international characters correctly

### Long Notes
- [ ] Enter very long notes (>1000 characters)
- [ ] Verify notes are saved completely
- [ ] Verify UI handles long text appropriately (scrolling, wrapping)

### Many Starred Contacts
- [ ] Star 20+ contacts
- [ ] Verify performance remains good
- [ ] Verify CSV export includes all contacts
- [ ] Verify results list handles many starred items

---

## Test Summary

**Total Tests:** ~80+
**Pass:** ___
**Fail:** ___
**Notes:**

---

## Bug Report Template

If you find issues during testing, use this format:

**Issue:** [Brief description]
**Steps to Reproduce:**
1. ...
2. ...
3. ...

**Expected Result:** ...
**Actual Result:** ...
**Severity:** [Low/Medium/High/Critical]
**Browser/Environment:** ...
