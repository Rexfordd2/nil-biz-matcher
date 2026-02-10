# Location-Based Filtering - User Guide

## Overview

The Recruiting Explore panel now includes location-based filtering, allowing you to search for organizations within a specific radius of any location.

## How to Use

### Method 1: Manual Location Entry

1. Navigate to **Recruiting → Explore (Map)**
2. In the **Location Filter** section, enter a location:
   - City and State: "Seattle, WA"
   - ZIP code: "98101"
   - Full address: "1234 Main St, Seattle, WA"
3. Click **Apply**
4. Results are now filtered to show only organizations within the selected radius

### Method 2: Use Your Current Location

1. Navigate to **Recruiting → Explore (Map)**
2. In the **Location Filter** section, click **📍 Use my location**
3. Allow location access when prompted by your browser
4. Your current location is automatically applied
5. Results are filtered immediately

### Adjusting the Search Radius

1. Use the **Radius** dropdown to select:
   - 5 miles
   - 10 miles
   - 25 miles (default)
   - 50 miles
   - 100 miles
2. Results update automatically as you change the radius

### Clearing the Location Filter

1. Click the **Clear** button next to "Use my location"
2. Location filter is removed
3. All results from the map area are shown

## Features

### Distance Display

Each search result shows how far it is from your selected location:
```
Metro United FC
123 Main St, Los Angeles, CA
(12.3 mi)
```

### Persistent Location

Your last used location and radius are automatically saved. When you return to the Recruiting page, your previous location settings are restored.

### Smart Messaging

- **No location set:** "💡 Add a location to narrow results by distance"
- **No results in radius:** "No results within 25 miles of Seattle, WA. Try increasing the radius or adjusting your location."
- **Location set:** "✓ Location set: Seattle, WA"

### Error Handling

The system handles various scenarios gracefully:

- **Invalid address:** "Location not found. Please check the address."
- **Permission denied:** "Location permission denied. Please use manual input."
- **Network issues:** Clear error message with option to retry

## Tips

1. **Start broad, then narrow:** Begin with a larger radius (50-100 miles), then reduce it as you find results
2. **Use ZIP codes for precision:** ZIP codes are often more accurate than city names
3. **Check distance badges:** Use the distance information to prioritize nearby organizations
4. **Combine with other filters:** Location works alongside Sport, Level, and Org Type filters

## Example Workflows

### Finding Local Clubs

1. Click "📍 Use my location"
2. Set radius to 10 miles
3. Select Sport: "soccer"
4. Select Org Type: "club"
5. View nearby soccer clubs with distances

### Expanding Your Search

1. Enter location: "Los Angeles, CA"
2. Start with 25 mile radius
3. If few results, increase to 50 or 100 miles
4. Adjust map view to see geographic spread

### Targeting Specific Area

1. Enter ZIP code: "98101"
2. Set radius to 5 miles
3. Filter by Level: "college"
4. Find colleges within 5 miles of downtown Seattle

## Troubleshooting

### Browser Asks for Location Permission

This is normal. Click "Allow" to use the geolocation feature. If you deny access, you can still use manual location entry.

### "Location not found" Error

- Check spelling of city/state
- Try using ZIP code instead
- Try full address format
- Ensure you have internet connection

### Results Seem Wrong

- Verify your location is correct (shown in green text)
- Check the radius setting
- Remember: distance is calculated as-the-crow-flies, not driving distance

### Location Won't Clear

- Click the "Clear" button
- If persistent, refresh the page
- Check browser console for errors

## Technical Notes

- **Distance calculation:** Uses Haversine formula for accurate great-circle distance
- **Storage:** Location persists in browser localStorage (not sent to server)
- **Performance:** Filtering happens client-side after initial search
- **Privacy:** Geolocation data never leaves your browser

## Future Enhancements

Potential improvements for future releases:
- Autocomplete for location input
- Map centering on selected location
- Driving distance (not just straight-line)
- Location favorites/history
- Multi-location search
- Export results with distances
