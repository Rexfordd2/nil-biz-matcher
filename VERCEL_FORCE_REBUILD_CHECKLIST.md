# Vercel Force Rebuild from origin/main Checklist

## Step 1: Confirm Production Branch
- [ ] Go to Vercel Dashboard → Project Settings → Git
- [ ] Verify **Production Branch** is set to `main`
- [ ] If not, change it to `main` and save

## Step 2: Trigger Deploy from Git (Latest Commit)
- [ ] Go to Vercel Dashboard → Deployments tab
- [ ] Click **"Deploy"** dropdown → Select **"Deploy from Git"**
- [ ] **DO NOT** use "Redeploy" (that uses cached commit)
- [ ] Select branch: `main`
- [ ] Click **"Deploy"**
- [ ] Wait for build to start

## Step 3: Verify Build Logs Show Correct Commit
- [ ] Open the new deployment → Click **"Build Logs"** tab
- [ ] Look for the line: `Cloning... Commit: 307fb322981ebda364bbd36f67fbade535106871`
- [ ] **Proof line format:** `Cloning... Commit: <SHA>`
- [ ] If SHA matches `307fb32...` (or current origin/main), proceed to Step 4
- [ ] If SHA is wrong/old, proceed to Step 4

## Step 4: Disconnect + Reconnect Git Integration
- [ ] Go to Project Settings → Git
- [ ] Click **"Disconnect Git Repository"** → Confirm
- [ ] Click **"Connect Git Repository"**
- [ ] Re-select your repository (Rexfordd2/nil-biz-matcher)
- [ ] Confirm Production Branch is `main`
- [ ] Save changes
- [ ] Trigger new deployment (Step 2)
- [ ] Verify Build Logs (Step 3)

## Step 5: Last Resort — Create New Vercel Project
- [ ] Go to Vercel Dashboard → **"Add New..."** → **"Project"**
- [ ] Import repository: `Rexfordd2/nil-biz-matcher`
- [ ] Set Production Branch: `main`
- [ ] Configure project settings (if needed)
- [ ] Click **"Deploy"**
- [ ] Verify Build Logs show correct commit SHA

## Proof Line in Build Logs
The line that confirms the fix:
```
Cloning... Commit: 307fb322981ebda364bbd36f67fbade535106871
```
This line appears early in the build logs and shows the exact commit SHA being cloned.
