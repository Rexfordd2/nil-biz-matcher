# Environment Variables: DEMO vs BETA

## Quick Comparison Table

| Variable | DEMO | BETA | Purpose |
|----------|------|------|---------|
| **APP_MODE** | `demo` | `beta` | Controls which surface is built |
| **VITE_PUBLIC_MODE** | `true` | `false` | Bypasses auth enforcement |
| **VITE_DEBUG_KEY** | ❌ Not set | ✅ `<secret>` | Build security (allows production build) |
| **VITE_WAITLIST_EMBED_HTML** | ✅ `<Mailchimp>` | ❌ Not set | Mailchimp embed for waitlist |
| **VITE_WAITLIST_EMBED_URL** | ✅ `<form URL>` | ❌ Not set | Fallback form URL |
| **VITE_SUPABASE_URL** | ❌ Optional | ✅ Required | Supabase project URL (client) |
| **VITE_SUPABASE_ANON_KEY** | ❌ Optional | ✅ Required | Supabase anon key (client) |
| **SUPABASE_URL** | ❌ Optional | ✅ Required | Supabase URL (server) |
| **SUPABASE_SERVICE_ROLE_KEY** | ❌ Optional | ✅ Required | Supabase service key (server) |
| **AUTH_SECRET** | ❌ Not needed | ✅ Recommended | Session signing secret |
| **APP_URL** | ❌ Optional | ✅ Recommended | App base URL for emails |
| **DATABASE_URL** | ❌ Optional | ⚠️ If using Prisma | Database connection |
| **SMTP_*** | ❌ Optional | ⚠️ If using email | Email sending config |
| **VITE_GOOGLE_MAPS_API_KEY** | ⚠️ Optional | ⚠️ Optional | Maps/Places API |

## DEMO Environment Variables (Complete)

```bash
#############################################
# REQUIRED - Core Mode Settings
#############################################
APP_MODE=demo
VITE_PUBLIC_MODE=true

#############################################
# REQUIRED - Waitlist (at least one)
#############################################
# Option 1: Mailchimp embed (preferred)
VITE_WAITLIST_EMBED_HTML=<div id="mc_embed_signup"><form action="https://example.us21.list-manage.com/subscribe/post?u=xxx&amp;id=yyy" method="post">...</form></div>

# Option 2: External form URL (fallback)
VITE_WAITLIST_EMBED_URL=https://forms.google.com/your-form-id
VITE_WAITLIST_EMBED_TITLE=Waitlist signup form

#############################################
# OPTIONAL - Enhanced Features
#############################################
# Google Maps (if you want live search in demo)
VITE_GOOGLE_MAPS_API_KEY=AIzaSyC...

# Supabase (only if you want server persistence in demo)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

## BETA Environment Variables (Complete)

```bash
#############################################
# REQUIRED - Core Mode Settings
#############################################
APP_MODE=beta
VITE_PUBLIC_MODE=false

#############################################
# REQUIRED - Build Security
#############################################
# Random secret to satisfy vite.config.ts security plugin
VITE_DEBUG_KEY=your-random-secret-here-min-20-chars

#############################################
# REQUIRED - Supabase (Client-side)
#############################################
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

#############################################
# REQUIRED - Supabase (Server-side)
#############################################
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

#############################################
# RECOMMENDED - Auth & App Config
#############################################
AUTH_SECRET=generate-a-long-random-string-for-session-signing
APP_URL=https://beta.athlete-ledger.vercel.app

#############################################
# OPTIONAL - Database (if using Prisma)
#############################################
DATABASE_URL=postgresql://user:pass@host:5432/db

#############################################
# OPTIONAL - Email (if using recruiting features)
#############################################
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=Athlete Ledger <noreply@example.com>

#############################################
# OPTIONAL - Enhanced Features
#############################################
VITE_GOOGLE_MAPS_API_KEY=AIzaSyC...
GOOGLE_MAPS_API_KEY=AIzaSyC...  # server-side
GOOGLE_MAPS_REGION_BIAS=us
```

## Key Differences Explained

### 1. **APP_MODE** - The Main Switch
- **DEMO**: Public surface, waitlist-focused
- **BETA**: Full app, auth-required

### 2. **VITE_PUBLIC_MODE** - Auth Enforcement
- **DEMO** (`true`): No auth required, all routes public
- **BETA** (`false`): Auth enforced, `/app` routes gated

### 3. **Waitlist Variables** - Only in DEMO
- DEMO needs at least one waitlist embed configured
- BETA should NOT have these set (no waitlist CTAs)

### 4. **Supabase** - Different Requirements
- **DEMO**: Optional (only if you want server-side persistence)
- **BETA**: Required (mandatory for auth and data persistence)

### 5. **VITE_DEBUG_KEY** - Build Security
- **DEMO**: Not needed (PUBLIC_MODE=true satisfies build plugin)
- **BETA**: Required (build plugin needs debug protection configured)

## Environment Setup Commands

### Set DEMO vars locally:
```bash
cat > .env.local << 'EOF'
APP_MODE=demo
VITE_PUBLIC_MODE=true
VITE_WAITLIST_EMBED_URL=https://forms.google.com/your-form
EOF
```

### Set BETA vars locally:
```bash
cat > .env.local << 'EOF'
APP_MODE=beta
VITE_PUBLIC_MODE=false
VITE_DEBUG_KEY=local-dev-secret-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
EOF
```

## Vercel CLI Commands

### Add DEMO vars:
```bash
# Switch to DEMO project context
vercel link --project=athlete-ledger-demo

# Add variables
echo "demo" | vercel env add APP_MODE production
echo "true" | vercel env add VITE_PUBLIC_MODE production
echo "https://forms.google.com/..." | vercel env add VITE_WAITLIST_EMBED_URL production
```

### Add BETA vars:
```bash
# Switch to BETA project context
vercel link --project=athlete-ledger-beta

# Add variables
echo "beta" | vercel env add APP_MODE production
echo "false" | vercel env add VITE_PUBLIC_MODE production
echo "your-secret" | vercel env add VITE_DEBUG_KEY production
# ... continue with Supabase vars
```

## Validation Checklist

### DEMO Project ✓
- [ ] `APP_MODE=demo` is set
- [ ] `VITE_PUBLIC_MODE=true` is set
- [ ] At least one waitlist variable set
- [ ] NO `VITE_DEBUG_KEY` (not needed)
- [ ] Supabase vars are optional

### BETA Project ✓
- [ ] `APP_MODE=beta` is set
- [ ] `VITE_PUBLIC_MODE=false` is set
- [ ] `VITE_DEBUG_KEY` is set
- [ ] All Supabase vars are set (client + server)
- [ ] NO waitlist variables set

## Troubleshooting

### "Waitlist embed not configured" (DEMO)
**Fix**: Set `VITE_WAITLIST_EMBED_HTML` or `VITE_WAITLIST_EMBED_URL`

### Build fails: "Debug routes must be protected" (BETA)
**Fix**: Set `VITE_DEBUG_KEY=<random-secret>`

### /app not gating auth (BETA)
**Fix**: Verify `APP_MODE=beta` and `VITE_PUBLIC_MODE=false`

### Routes redirecting incorrectly
**Fix**: Redeploy to ensure latest env vars are applied
