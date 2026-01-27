# Vercel Access Handoff for Deployment

## 🚨 Why We're Blocked

Deployment is blocked because GitHub Actions needs a Vercel authentication token and project identifiers to deploy. These must be added as GitHub repository secrets by someone with Vercel access.

**What's needed:** VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID as GitHub secrets.

---

## ✅ Step-by-Step Deployment Instructions (< 5 minutes)

### Step 1: Create Vercel Token

1. Log into Vercel at https://vercel.com
2. Navigate to: **Account Settings → Tokens**
   - Direct link: https://vercel.com/account/tokens
3. Click **"Create Token"**
4. Name it: `GitHub Actions - Monster Collective`
5. Set Scope: **Full Account** (or select the Monster Collective project if available)
6. Set Expiration: **No Expiration** (or 1 year minimum)
7. Click **"Create"**
8. **COPY THE TOKEN IMMEDIATELY** (you can only see it once!)

### Step 2: Add GitHub Repository Secrets

1. Go to the GitHub repository: https://github.com/[YOUR_USERNAME]/monster-collective
2. Navigate to: **Settings → Secrets and variables → Actions**
   - Full path: `Repo → Settings → Secrets and variables → Actions`
3. Click **"New repository secret"** for each of the following:

#### Secret 1: VERCEL_TOKEN
- **Name:** `VERCEL_TOKEN`
- **Value:** [paste the token you just created in Step 1]

#### Secret 2: VERCEL_ORG_ID
- **Name:** `VERCEL_ORG_ID`
- **Value:** `team_3afvMrd9BHXAk9ULFIuSRIfo`

#### Secret 3: VERCEL_PROJECT_ID
- **Name:** `VERCEL_PROJECT_ID`
- **Value:** `prj_omEmNLLhHETdIZqmBSEkAeJCu0ha`

### Step 3: Trigger the Deployment

1. Go to: **GitHub → Actions tab**
2. Select workflow: **"Vercel Production Deployment"** (in the left sidebar)
3. Click **"Run workflow"** dropdown (top right)
4. Select branch: `main`
5. Click **"Run workflow"** button
6. Wait 2-3 minutes for deployment to complete

### Step 4: Verify Production Deployment

After the workflow shows success:

1. Open PowerShell in the project directory
2. Run: `.\scripts\verify-production-api.ps1`
3. Confirm output shows:
   - ✅ All API endpoints responding
   - ✅ `gitCommitSha` matches latest commit on `origin/main`
   - ✅ Production is live at https://monster-collective.vercel.app

**Alternative verification (manual):**
```bash
# Check deployment SHA matches latest main
git rev-parse origin/main

# Then visit in browser and check console logs for version info
https://monster-collective.vercel.app
```

---

## 🔧 Troubleshooting

### If deployment fails with "Invalid token"
- The VERCEL_TOKEN may have been copied incorrectly or expired
- Regenerate a new token and update the GitHub secret

### If deployment fails with "Project not found"
- Verify VERCEL_PROJECT_ID and VERCEL_ORG_ID are correct
- Check in Vercel dashboard → Project Settings → General for the correct IDs

### If the workflow doesn't appear
- Ensure the `.github/workflows/vercel-production.yml` file exists in the main branch
- The workflow may need to be manually enabled in Actions settings

---

## 🔄 Plan B: Alternative Hosting (If Vercel Access Unavailable)

If Vercel access cannot be obtained, we can deploy to **Netlify** or **Cloudflare Pages** as a fallback. Both support static site hosting with our Vite build output.

### ⚠️ Important Limitation
The `/api/*` serverless endpoints will **NOT work** with these alternatives unless we:
- Migrate API routes to Netlify Functions or Cloudflare Workers
- Or deploy a separate backend service

Static pages and client-side features will work fine.

---

### Option A: Netlify Deployment

#### Via Netlify CLI (Fastest - 2 minutes)

1. **Install Netlify CLI:**
```powershell
npm install -g netlify-cli
```

2. **Build the project:**
```powershell
npm run build
```

3. **Login to Netlify:**
```powershell
netlify login
```

4. **Deploy:**
```powershell
netlify deploy --prod --dir=dist
```

5. **Follow prompts:**
   - Create new site or link existing
   - Choose team/account
   - Site deploys to `https://[random-name].netlify.app`

#### Via Netlify Web UI (3 minutes)

1. Go to https://app.netlify.com
2. Click **"Add new site → Import an existing project"**
3. Connect to GitHub and select the repository
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Node version:** 18 or higher (set in `netlify.toml` or environment variable)
5. Click **"Deploy site"**

#### Add Environment Variables (If needed)

1. Go to: **Site settings → Environment variables**
2. Add all variables from `.env.production`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - etc.

---

### Option B: Cloudflare Pages Deployment

#### Via Wrangler CLI (Fastest - 2 minutes)

1. **Install Wrangler:**
```powershell
npm install -g wrangler
```

2. **Build the project:**
```powershell
npm run build
```

3. **Login to Cloudflare:**
```powershell
wrangler login
```

4. **Deploy:**
```powershell
wrangler pages deploy dist --project-name=monster-collective
```

5. Site deploys to: `https://monster-collective.pages.dev`

#### Via Cloudflare Dashboard (3 minutes)

1. Go to https://dash.cloudflare.com
2. Navigate to: **Workers & Pages → Create application → Pages → Connect to Git**
3. Select the GitHub repository
4. Configure build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Click **"Save and Deploy"**

#### Add Environment Variables (If needed)

1. Go to: **Settings → Environment Variables**
2. Add all variables from `.env.production`

---

### Migrating API Routes (For Full Functionality)

If you choose Plan B and need the API endpoints to work:

#### For Netlify Functions:
1. Move `/api` folder to `/netlify/functions`
2. Convert each endpoint to Netlify Function format:
```javascript
// netlify/functions/waitlist.js
exports.handler = async (event, context) => {
  // Your existing API logic
  return {
    statusCode: 200,
    body: JSON.stringify({ data: "result" })
  };
};
```

#### For Cloudflare Workers:
1. Create `wrangler.toml` configuration
2. Convert API routes to Workers format with `fetch` handlers
3. Deploy workers separately with `wrangler deploy`

---

## 📝 Summary Checklist

### Vercel Deployment (Preferred):
- [ ] Create Vercel token
- [ ] Add 3 GitHub secrets (VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID)
- [ ] Run GitHub Actions workflow
- [ ] Verify production with script

### Plan B (If Vercel Blocked):
- [ ] Choose Netlify or Cloudflare Pages
- [ ] Install CLI tool or use web interface
- [ ] Build and deploy
- [ ] Note: API routes need migration for full functionality

---

## 🎯 Expected Outcome

**After completion**, the site should be live at:
- **Vercel:** https://monster-collective.vercel.app
- **Netlify:** https://[sitename].netlify.app
- **Cloudflare:** https://monster-collective.pages.dev

And the production verification script should show all green checkmarks! ✅

---

## Questions?

If you encounter any issues:
1. Check GitHub Actions logs for specific error messages
2. Verify all secrets are spelled exactly as shown (case-sensitive)
3. Ensure the Vercel token has full account access
4. Contact the team in #deployment channel
