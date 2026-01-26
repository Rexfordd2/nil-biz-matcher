## Deploy Diagnostics & Checklist

Use this checklist before deploying to ensure the correct repository, branch, and configuration are used. The build logs will print diagnostics via `scripts/print-build-info.js`.

### Quick Checklist
- [ ] Remote URL is correct (e.g., GitHub/GitLab/Bitbucket origin)
- [ ] Target branch is correct (e.g., `main` or `prod`)
- [ ] Vercel project is linked to the correct repo
- [ ] Clear Vercel build cache (if needed) and redeploy

### Verify Git Remote and Branch
- Remote URL:
  - `git remote -v`
- Current branch:
  - `git rev-parse --abbrev-ref HEAD`
- Last commit:
  - `git log -1 --oneline`

### Vercel Build Diagnostics
During `npm run build`, the following will be printed:
- Repo name (if available)
- Remote origin URL (if available)
- Branch (from Vercel env or git)
- Commit SHA (short)

These values are sourced from:
- `VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_COMMIT_SHA`
- `VERCEL_GIT_REPO_OWNER`, `VERCEL_GIT_REPO_SLUG`
- Fallback to local git where available

### Clear Cache and Redeploy on Vercel
1. Open the Vercel dashboard for your project.
2. Go to Deployments.
3. Click Redeploy on the desired commit.
4. Toggle “Clear build cache”.
5. Confirm redeploy.

### Notes
- The diagnostics script runs as part of the build step: `tsc -b && node scripts/print-build-info.js && vite build`.
- If the repo is not available in the build environment, diagnostics will still print whatever can be inferred from environment variables.


