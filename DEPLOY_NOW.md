# 🚀 DEPLOY NOW - Quick Start Guide

## Prerequisites (One-Time Setup)

### 1. Set Vercel Environment Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these variables for **Production** environment:

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_PUBLIC_MODE` | `true` | ✅ YES |
| `SUPABASE_URL` | `https://duuvyyvfqbzozuhzlbek.supabase.co` | ✅ YES |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Supabase Dashboard) | ✅ YES |

**Where to find Supabase Service Role Key:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `duuvyyvfqbzozuhzlbek`
3. Go to Settings → API
4. Copy "service_role" key (⚠️ Keep this secret!)

---

## Deploy Command (Run This Now)

```bash
npx vercel --prod --build-env VITE_PUBLIC_MODE=true
```

**Expected output:**
```
✔ Deployment complete
🔍 Inspect: https://vercel.com/...
✅ Production: https://athlete-ledger.vercel.app [ready]
```

**Time estimate:** 2-3 minutes

---

## Post-Deploy Verification (Run These)

### Quick Smoke Test (30 seconds)

Replace `YOUR_DOMAIN` with your deployed domain (e.g., `athlete-ledger.vercel.app`)

```bash
# Test 1: Root loads
curl -I https://YOUR_DOMAIN/

# Test 2: Waitlist health check
curl https://YOUR_DOMAIN/api/waitlist

# Test 3: Waitlist submission
curl -X POST https://YOUR_DOMAIN/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"deploy-test@example.com","source":"verification"}'
```

**Expected results:**
- Test 1: `HTTP/2 200` (HTML page)
- Test 2: `{"ok":true}`
- Test 3: `{"ok":true,"status":"created"}` or `{"ok":true,"status":"already_registered"}`

### Browser Test (1 minute)

1. Open `https://YOUR_DOMAIN/` in browser
2. **Check:** Landing page loads with no login prompt ✅
3. **Check:** "Join Waitlist" section is visible ✅
4. **Check:** Click "Try Demo" button → goes to /app ✅
5. **Check:** Visit `/auth/login` → shows "Login disabled" screen ✅
6. **Check:** Visit random URL like `/xyz` → redirects to landing ✅

---

## If Something Goes Wrong

### Waitlist returns `{"ok":false,"error":"missing_env"}`

**Fix:**
1. Check Vercel env vars are set correctly
2. Redeploy: `npx vercel --prod`

### Auth routes crash (white screen)

**Fix:**
1. Ensure `VITE_PUBLIC_MODE=true` is set in Vercel
2. Redeploy: `npx vercel --prod --build-env VITE_PUBLIC_MODE=true`

### Build fails with "debug routes must be protected"

**Fix:**
1. Use the deploy command with `--build-env VITE_PUBLIC_MODE=true`
2. Or set `VITE_PUBLIC_MODE=true` permanently in Vercel Dashboard

---

## Success! What's Next?

Once all smoke tests pass:

1. ✅ **Announce the launch** on social media
2. ✅ **Share the waitlist link** with your audience
3. ✅ **Monitor Supabase** for waitlist signups
4. ✅ **Check Vercel Analytics** for traffic

---

## Monitoring Commands

### Check waitlist count (Supabase SQL)
```sql
SELECT COUNT(*) as total_signups FROM waitlist;
```

### View recent signups (Supabase SQL)
```sql
SELECT email, source, created_at 
FROM waitlist 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Support

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Deployment Logs:** Check Vercel Dashboard → Deployments → [Latest] → Logs

---

**Ready to deploy?** Run the command above! 🚀
