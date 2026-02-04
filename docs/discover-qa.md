## Discover Businesses - QA Checklist

Use this checklist to verify the Discover Businesses feature end-to-end.

### Setup
- Ensure `.env.local` contains a valid `VITE_GOOGLE_MAPS_API_KEY` (Maps JS + Places enabled).
- For detailed setup instructions, see: [docs/google-maps-setup.md](./google-maps-setup.md)
- Restart dev server after changing environment variables.

### Load & Script
- Navigate to the Discover tab.
- Confirm no duplicate Google Maps script tags are injected on route changes.
- Confirm no console errors related to Google Maps/Places.

### Inputs
- The UI shows two inputs:
  - “What” (keyword, e.g., "pizza", "gym", "marketing")
  - “Where” with Places Autocomplete (type a city/zip and select a suggested place)
- If `VITE_GOOGLE_MAPS_API_KEY` is missing:
  - A clear banner warns that the key is missing.
  - The Search button is disabled.

### Search & Results
- Enter a keyword and a location (choose from Autocomplete), then click Search.
- Loading state appears while searching.
- A list of result cards appears on the left (desktop) or above the map (mobile).
- An empty state appears for no results.

### Map
- A Google Map renders to the right (desktop) or below the list (mobile).
- Markers are placed for each result with coordinates.
- Clicking a result card:
  - Highlights the corresponding marker.
  - Centers the map on the marker.
- Clicking a marker:
  - Selects/highlights the corresponding result card.

### Details Panel
- When a result is selected, a details panel shows:
  - Name, address, rating, user ratings total if available
  - Phone, website, opening hours (when available)
  - A link to open in Google Maps
- Desktop: details appear in a right-side panel.
- Mobile: details appear in a modal and can be closed.

### States & Errors
- Loading skeletons show while searching and fetching details.
- No stale/duplicate results show when rapidly re-submitting searches.
- No script re-injection occurs during navigation.

### Responsiveness
- Desktop: results list on left, map on right, details on the right side panel.
- Mobile: stacked vertically; details in a modal.

### Build
- `npm run build` succeeds.
- No type or linter errors related to Discover, hooks, or loader.


