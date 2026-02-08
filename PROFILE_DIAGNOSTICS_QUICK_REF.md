# Athlete Profile Diagnostics - Quick Reference Card

## 🚀 Quick Start

### Run Automated Diagnostic
```bash
npm run diag:profile
```

**Exit 0** = ✅ Everything works  
**Exit 1** = ❌ Something failed (see error details)

---

## 🔍 Enable Debug Mode

Add to URL:
```
?debug=1
```

**Example:**
- Local: `http://localhost:5173/app?debug=1`
- Production: `https://your-app.com/app?debug=1`

**Shows:**
- Current user ID
- Profile fetch status
- Save status with timestamps
- **Full Supabase error** (code, message, details, hint, payload keys)

---

## 🛠️ Fix Database Issues

### Option 1: Run Fix Script (Recommended)
```sql
-- In Supabase SQL Editor
-- Copy/paste: SUPABASE_FIX_ATHLETE_PROFILES.sql
-- Click "Run"
```

### Option 2: Apply Migration
```bash
supabase db push
```

---

## 📊 Verify Database State

```sql
-- In Supabase SQL Editor
-- Copy/paste: SUPABASE_VERIFICATION_QUERIES.sql
-- Run each query, compare with expected results
```

**Key queries:**
- 1A: Table exists + RLS enabled
- 1B: Columns (user_id uuid, profile jsonb)
- 1E: Policies (4 expected: SELECT, INSERT, UPDATE, DELETE)

---

## ⚠️ Common Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| `42P01` | Table doesn't exist | Run fix script |
| `42501` | RLS blocks access | Check policies |
| `23503` | FK violation | User not in auth.users |
| `PGRST301` | JWT invalid | Re-authenticate |

---

## 📋 Required .env Variables

```bash
# Supabase
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Test credentials (for npm run diag:profile)
SUPABASE_TEST_EMAIL=test@example.com
SUPABASE_TEST_PASSWORD=test-password-123
```

---

## 🎯 Expected Table Schema

```sql
CREATE TABLE public.athlete_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**RLS:** Enabled  
**Policies:** 4 (SELECT, INSERT, UPDATE, DELETE)  
**Predicate:** `user_id = auth.uid()`

---

## 🔄 Typical Workflow

### When save fails:

1. **User sees:** "Save failed: [error]"
2. **Developer checks:** Add `?debug=1` to URL
3. **Debug panel shows:** Error code `42501`
4. **Run diagnostic:** `npm run diag:profile`
5. **Apply fix:** Run `SUPABASE_FIX_ATHLETE_PROFILES.sql`
6. **Verify:** `npm run diag:profile` → ✅ Pass
7. **Test in UI:** Save again → ✅ Success

**Time to fix:** ~5 minutes

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `scripts/diagnose-athlete-profile.mjs` | Automated test script |
| `SUPABASE_VERIFICATION_QUERIES.sql` | Manual verification queries |
| `SUPABASE_FIX_ATHLETE_PROFILES.sql` | One-click fix script |
| `src/components/AthleteProfileDebugPanel.tsx` | Visual debug UI |
| `DIAGNOSTICS_USAGE_GUIDE.md` | Full documentation |

---

## 🎨 Debug Panel Indicators

- 🟢 **Green dot** = Success, all working
- 🟡 **Yellow pulsing** = Save in progress
- 🔴 **Red dot** = Error occurred
- ⚫ **Gray dot** = Idle

---

## 💡 Pro Tips

1. **Always test with debug mode first:** `?debug=1`
2. **Run diagnostic before reporting bugs:** `npm run diag:profile`
3. **Check console logs in dev mode:** Errors auto-logged
4. **Keep test user credentials secure:** Use separate test account
5. **Run diagnostic monthly:** Proactive health checks

---

## 🚨 When to Use Each Tool

| Tool | Use When |
|------|----------|
| Debug panel (`?debug=1`) | Debugging in browser |
| Diagnostic script | Testing database/auth |
| Verification queries | Manual DB inspection |
| Fix script | Repairing DB issues |

---

**Last Updated:** 2026-02-03  
**Print this card and keep it handy!**
