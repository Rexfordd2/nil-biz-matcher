# Athlete Profile Save Queue - Quick Reference

## TL;DR

The athlete profile save system now uses a **single-writer queue** to prevent concurrent writes, eliminate stale state overwrites, and provide deterministic save behavior with automatic retry logic.

## Key Features

### 1. Single-Writer Queue
- ✅ Only one save in-flight at a time
- ✅ Newest save is queued if one is already running
- ✅ Queued save executes immediately after current save completes
- ✅ No race conditions or concurrent upserts

### 2. Automatic Retry
- ✅ Retries transient failures (network, 5xx) up to 2 times
- ✅ Exponential backoff: 500ms → 1000ms
- ✅ Does NOT retry RLS/403/auth errors (fails fast)
- ✅ Logs all retry attempts to console

### 3. Version Control
- ✅ Tracks `updated_at` timestamp from server
- ✅ Prevents localStorage drafts from overwriting newer DB data
- ✅ Post-save verification ensures save succeeded

### 4. Debug Mode (?debug=1)
- ✅ Shows queue state (in-flight, queued, attempt count)
- ✅ Shows last payload key count and size
- ✅ Shows retry attempts and error details
- ✅ Real-time status indicators

## How It Works

### Save Flow

```
User makes change
    ↓
onDraftChange() called
    ↓
Deep merge with previous state (if partial)
    ↓
Update latestDraftRef
    ↓
Debounce (800ms)
    ↓
flushSave() triggered
    ↓
Check if save in-flight? ──Yes──→ Queue save, return
    |                               ↓
    No                        (waits for completion)
    ↓                               ↓
Mark in-flight                Process queued save
    ↓
executeSave()
    ↓
Attempt 1 ──Fail (transient)──→ Wait 500ms → Attempt 2
    |                                           |
    Success                                  Success/Fail
    ↓                                           ↓
Verify save (SELECT)                    Verify save
    ↓                                           ↓
Update refs & localStorage              Update refs & localStorage
    ↓                                           ↓
Mark complete                           Mark complete
    ↓                                           ↓
Check for queued save? ──Yes──→ Process queued save
    |
    No
    ↓
Done
```

### Retry Logic

```typescript
if (!isNonRetryable && attemptNumber <= MAX_RETRIES) {
  const backoffMs = attemptNumber === 1 ? 500 : 1000
  await new Promise(resolve => setTimeout(resolve, backoffMs))
  return executeSave(body, attemptNumber + 1)
}
```

**Retryable Errors:**
- Network errors
- Timeout errors
- 500/502/503 errors

**Non-Retryable Errors:**
- 403 Forbidden
- 42501 (RLS/Permission denied)
- PGRST301 (Postgrest auth error)
- "not authenticated" errors

### Queue State

```typescript
type SaveQueueState = {
  isInFlight: boolean       // Is a save currently executing?
  queuedSave: QueuedSave    // Pending save waiting to execute
  lastAttemptCount: number  // Total save attempts (for debugging)
}
```

## Usage

### For Users

1. **Normal Use**: Just edit fields and save. Everything is automatic.
2. **Rapid Changes**: Make changes as fast as you want - they'll be queued.
3. **Save Button**: Click "Save Profile" - it waits for queue to drain before showing "Saved"
4. **Debug Mode**: Add `?debug=1` to URL to see what's happening under the hood

### For Developers

#### Accessing Debug Info

```typescript
const autosave = useAutosaveProfile({ user, debounceMs: 800 })

// Debug queue state (only populated in dev mode)
console.log(autosave._debugQueueState)
// {
//   isInFlight: false,
//   queuedSave: null,
//   lastAttemptCount: 3
// }
```

#### Manual Save with Verification

```typescript
// Trigger save and wait for queue to drain
await autosave.saveNow()

// At this point:
// - All queued saves have completed
// - Verification has passed
// - Safe to show "Saved" UI
```

#### Monitoring Saves

```javascript
// In browser console with ?debug=1
window.__lastProfileSavePayload
// {
//   timestamp: 1707062400000,
//   keys: ['name', 'school', 'sports', ...],
//   criticalFields: { name: 'John Doe', school: 'UCLA', ... },
//   fullSize: 4567,
//   attemptNumber: 1
// }
```

## Testing

### Quick Manual Test

1. **Basic Save**: Change 5 fields → Save → Refresh → Verify
2. **Queue Test**: Add `?debug=1` → Make rapid changes → Watch queue state
3. **Retry Test**: Go offline → Make change → See retries → Go online → Verify save

### Automated Test (Recommended)

Open `test-profile-save-queue.html` in your browser and follow the guided test steps.

## Troubleshooting

### Save Not Working

**Symptoms:** Changes don't persist after refresh

**Check:**
1. Open DevTools Console (F12)
2. Look for error messages starting with `[Profile Save Error]`
3. Check if user is authenticated: `supabase.auth.getUser()`
4. Verify RLS policies allow INSERT/UPDATE for user's profile

**Common Causes:**
- Not authenticated (session expired)
- RLS policies blocking save
- Network offline
- Invalid profile data (blocked by safety guards)

### Queue Not Draining

**Symptoms:** "In-Flight" indicator stays yellow forever

**Check:**
1. Add `?debug=1` to URL
2. Look at "Save Queue State" section
3. Check Console for errors
4. Check Network tab for hanging requests

**Common Causes:**
- Request timeout (server not responding)
- Verification SELECT failed (RLS policy)
- JavaScript error during save

### Partial Profile Detected

**Symptoms:** Error message "Partial profile detected - save blocked"

**Explanation:** Safety guard detected that you're trying to save a profile with significantly fewer fields than the server has. This prevents accidental data loss.

**Fix:**
1. Refresh the page to reload full profile
2. Make your changes again
3. Save should work normally

**If it persists:**
- Check that form is not sending partial updates
- Verify deep merge logic in `onDraftChange`

## Performance

### Memory Usage
- Queue depth limited to 1 (newest save only)
- No unbounded growth
- Old queued saves replaced, not appended

### Network Usage
- Max 3 requests per save (1 initial + 2 retries)
- Verification SELECT adds 1 extra request per save
- Debounce (800ms) reduces unnecessary saves

### CPU Usage
- Polling interval: 100ms (only during `saveNow()`)
- No tight loops or blocking operations
- All async/await based

## API Reference

### useAutosaveProfile

```typescript
const {
  initialProfile,      // Profile loaded from DB
  status,             // 'idle' | 'saving' | 'saved' | 'error' | 'loading'
  statusText,         // Human-readable status
  lastSavedAt,        // Timestamp of last successful save
  lastSaveAttempt,    // Timestamp of last attempt (including failures)
  profileFetched,     // Has initial profile loaded?
  error,              // Error message (if any)
  errorRaw,           // Raw Supabase error details
  onDraftChange,      // Call when form changes: onDraftChange(newProfile)
  saveNow,            // Trigger immediate save: await saveNow()
  refresh,            // Reload from server: refresh()
  _debugQueueState    // Queue state (dev mode only)
} = useAutosaveProfile({ user, debounceMs: 800 })
```

### AthleteProfileDebugPanel

```typescript
<AthleteProfileDebugPanel
  user={user}
  profileFetched={autosave.profileFetched}
  lastSaveAttempt={autosave.lastSaveAttempt}
  lastSavedAt={autosave.lastSavedAt}
  status={autosave.status}
  error={autosave.error}
  errorRaw={autosave.errorRaw}
  queueState={autosave._debugQueueState}
/>
```

Only visible when URL contains `?debug=1`.

## Console Logs

### Normal Operation

```
[Profile Load] Rehydration complete: { hasName: true, ... }
[Profile Save] Payload Details: { user_id: '...', profile_keys: [...], ... }
[Profile Save] Verified: { user_id: '...', updated_at: '...' }
```

### Queue Operation

```
[Profile Save] Save already in-flight, queuing...
[Profile Save] Processing queued save... { waitTime: 234 }
```

### Retry Operation

```
[Profile Save] Attempt 1 failed, retrying in 500ms...
[Profile Save] Attempt 2 failed, retrying in 1000ms...
[Profile Save Error] Final failure after retries: { ... }
```

### Success

```
[Profile Save] saveNow complete - all changes saved
```

## Environment Variables

No new environment variables required. Uses existing:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Files Changed

- ✅ `src/hooks/useAutosaveProfile.ts` - Core implementation
- ✅ `src/hooks/useAnonProfileDraft.ts` - Stub for consistency
- ✅ `src/components/AthleteProfileDebugPanel.tsx` - Debug UI
- ✅ `src/App.tsx` - Pass queue state to debug panel

## Migration Notes

### Breaking Changes
None. Fully backwards compatible.

### Behavioral Changes
- Saves are now sequential (queued) instead of potentially concurrent
- Save button (`saveNow()`) now waits for queue to drain
- Debug panel shows new queue state section

### Data Migration
None required. No schema changes.

## Support

For issues or questions:
1. Check this document first
2. Review `ATHLETE_PROFILE_SAVE_QUEUE_IMPLEMENTATION.md` for detailed info
3. Run `test-profile-save-queue.html` to diagnose issues
4. Check browser console with `?debug=1` for detailed logs

---

**Last Updated**: 2026-02-04  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
