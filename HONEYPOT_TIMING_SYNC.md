# Honeypot Timing Synchronization

## Summary
Updated the Playwright waitlist submission flow to use a shared timing constant to prevent drift between the app's anti-bot validation and test expectations.

## Changes Made

### 1. Created Shared Configuration (`src/config/honeypot.ts`)
**Purpose**: Centralize honeypot timing constants to ensure consistency across app and tests

**Exports**:
- `MIN_FORM_INTERACTION_TIME` (2000ms): The minimum time required before form submission to be considered legitimate
- `TEST_FORM_DELAY` (2100ms): Recommended test delay with safety buffer

### 2. Updated Application Code (`src/components/WaitlistForm.tsx`)
**Changes**:
- Imported `MIN_FORM_INTERACTION_TIME` from shared config
- Replaced hardcoded `2000` with the constant
- Added threshold value to observability logging for debugging

**Before**:
```typescript
if (elapsed < 2000) {
  // Log suspicious timing
}
```

**After**:
```typescript
if (elapsed < MIN_FORM_INTERACTION_TIME) {
  Observability.log({
    feature: 'ui',
    route: 'landing.waitlist.timing_suspicious',
    status: 'ui_action',
    meta: { elapsed, threshold: MIN_FORM_INTERACTION_TIME, source }
  })
}
```

### 3. Updated Playwright Tests (`tests/honeypot.spec.ts`)
**Changes**:
- Imported `TEST_FORM_DELAY` from shared config
- Replaced hardcoded `2500ms` wait with `TEST_FORM_DELAY` (2100ms)
- Added documentation explaining the synchronization

**Test Flow**:
1. Fill email field
2. Wait `TEST_FORM_DELAY` (2100ms) - ensures submission passes timing check
3. Submit form
4. Assert success state

## Benefits

### 1. **Eliminates Drift**
- App and tests now reference the same source of truth
- Changing the timing threshold only requires updating one file

### 2. **Clearer Intent**
- Named constants make the purpose explicit
- Comments link tests back to app configuration

### 3. **Maintainability**
- Future developers can see the relationship between timing values
- Reduces risk of tests becoming out of sync with app logic

### 4. **Safety Buffer**
- Tests use `TEST_FORM_DELAY` (2100ms) instead of exact minimum (2000ms)
- 100ms buffer accounts for timing variations and test execution overhead

## Configuration Reference

| Constant | Value | Purpose |
|----------|-------|---------|
| `MIN_FORM_INTERACTION_TIME` | 2000ms | App's minimum legitimate interaction time |
| `TEST_FORM_DELAY` | 2100ms | Test delay with safety buffer (MIN + 100ms) |

## Testing

The updated test flow simulates a legitimate user:
1. Loads the page (starts timer)
2. Fills email field
3. Waits > 2000ms (using `TEST_FORM_DELAY`)
4. Submits form
5. Expects success or error (API may not be available in test env)

## Usage

### For App Development
```typescript
import { MIN_FORM_INTERACTION_TIME } from '../config/honeypot'

const elapsed = Date.now() - startTime
if (elapsed < MIN_FORM_INTERACTION_TIME) {
  // Handle suspicious timing
}
```

### For Testing
```typescript
import { TEST_FORM_DELAY } from '../src/config/honeypot'

// Fill form fields
await emailInput.fill('test@example.com')

// Wait to simulate legitimate user interaction
await page.waitForTimeout(TEST_FORM_DELAY)

// Submit
await submitButton.click()
```

## Future Improvements

If timing requirements need to change:
1. Update values in `src/config/honeypot.ts`
2. All dependent code updates automatically
3. No need to search for hardcoded values

## Files Modified

- ✅ `src/config/honeypot.ts` (new)
- ✅ `src/components/WaitlistForm.tsx`
- ✅ `tests/honeypot.spec.ts`

## Validation

- ✅ No linter errors
- ✅ Imports resolve correctly
- ✅ Test timing matches app threshold + buffer
- ✅ Observability logging includes threshold value
