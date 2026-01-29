## Athlete Ledger

### Project summary
Athlete Ledger is a Vite + React app that matches NIL-ready student‑athletes (middle/high school) with local and regional businesses. It includes an Athlete Profile Builder (multi‑sport, multi‑position, multiple social handles and content styles) and Business Discovery via URL import and embedded external search (server‑side Google Places). A built‑in NIL Hub provides educational resources, including a link to the Skool community.

### Rebrand status
- UI title and header updated to “Athlete Ledger”.
- Logo path now `/athlete-ledger-logo.png` (falls back gracefully if missing).
- Future step: map Figma components and tokens to Tailwind theme.

### Migration from Figma
We will port the UX/UI from the Figma file to this codebase. Reference design: `https://www.figma.com/make/3uFixuxyIoQsJgqbD6kZtN/Athlete-Ledger-Web-App-Design?t=NjypYY9xTKMUwYwc-20&fullscreen=1`.

#### Screen mapping checklist
- App shell: Header, navigation, layout container
- Athlete Profile: form fields, validation, preview
- Business Discovery: search/import, results list, details
- Matches: scoring card, strategy, opportunity cost
- Deals / Opportunities / Events: boards and planners
- NIL Hub / Resources / Guidelines
- Recruiting Finder / Recruiting Board
- Vendor Directory

For each Figma frame, identify: component structure, states (empty/loading/error), tokens (colors, radii, spacing, typography), and interactions. Map to Tailwind classes or add tokens in `src/theme/tokens.ts` as needed.


### Domain auto‑discovery and verification

You can verify all deployed domains without manually setting `DOMAINS`. The script will auto‑discover domains/aliases from Vercel for the current project.

- How the project is found:
  - Uses `VERCEL_PROJECT_ID` if set.
  - Else reads `.vercel/project.json` created by `vercel link` (uses `projectId` or `projectName`).
  - Else uses `vercel.json` `"name"` and resolves it via the Vercel API.
  - Scope: if `VERCEL_ORG_ID` is set (e.g., `team_...`), it is passed for team scoping.

- Requirements:
  - `VERCEL_TOKEN` must be set (Vercel personal access token).

- Usage (PowerShell):
  ```powershell
  $env:VERCEL_TOKEN = "<your-vercel-token>"
  npm run verify:all-domains
  ```

- Notes:
  - The discovery script prints a first line CSV suitable for `DOMAINS`, followed by a readable list.
  - You can also fetch the list directly:
    ```powershell
    npm run get:vercel:domains
    ```

### Features
- **Athlete Profile Builder**: multi‑sport, multi‑position, social handles, content styles.
- **Business import from URL (auto‑scrape)**: pulls title, description, social links, and basic signals.
- **Embedded business search (Google Places, server‑side)**: searches businesses using Google Places via a serverless API route.
- **Fit analysis logic (LOCAL / REGIONAL / NATIONAL)**: heuristic analysis for business level and needs.
- **NIL Hub tab**: curated guidance; inspired by Opendorse / NIL.go / NIL.store; includes Skool community link.

### Tech stack
- **Framework**: Vite 5 + React 18 + TypeScript
- **Styling**: Tailwind CSS
- **HTTP**: native `fetch`
- **State**: React hooks (no external global state library)
- **Build/dev**: Vite (`dev`, `build`, `preview` scripts)

Paths of interest:
- `src/components/*`: UI (forms, analysis cards, NIL Hub, etc.)
- `api/business/search.ts`: Business search API (Google Places)
- `src/utils/importer.ts`: URL importer (auto‑scrape)
- `src/utils/analysis.ts`: fit/level heuristics
- `src/config/env.ts`: runtime env configuration and feature gating

### Setup & install
1) **Clone**
   - `git clone <your-repo-url>`
   - `cd athlete-ledger`
2) **Install dependencies**
   - Using npm (recommended, `package-lock.json` present): `npm install`
3) **Environment variables**
   - Copy `.env.example` to `.env` and adjust values (see below).
4) **Run the dev server**
   - `npm run dev`
   - App runs on `http://localhost:5173` by default.

### Environment variables
Copy `.env.example` to `.env` and set:
- `GOOGLE_MAPS_API_KEY` (required) — server‑side Google Maps/Places API key
- `GOOGLE_MAPS_REGION_BIAS` (optional) — region bias for search (e.g., `us`, `ca`)

Notes:
- The key is used only on the server in `/api/business/search`; it is never exposed to the client.

### Run & build
- **Dev**: `npm run dev`
- **Build**: `npm run build` (outputs to `dist/`)
- **Preview (static server)**: `npm run preview`
- **Tests**: `npm test` (runs unit tests with vitest)

### CI Gates (Running Locally)

Before pushing code or creating a PR, you can run the same checks that CI will run:

```bash
# Install dependencies (clean install, like CI)
npm ci

# Run all CI checks locally
npm test              # Run unit tests
npm run verify:lint   # Check TypeScript types
npm run build         # Build the application (will fail if debug routes are unprotected)
```

**CI Pipeline Checks:**
1. **Dependencies**: `npm ci` ensures a clean install from `package-lock.json`
2. **Tests**: `npm test` runs all unit tests (vitest)
3. **Linting**: `npm run verify:lint` checks TypeScript types (`tsc --noEmit`)
4. **Build**: `npm run build` builds the application and will fail if:
   - TypeScript compilation errors exist
   - Debug routes are not protected (when `VITE_DIAGNOSTICS` and `VITE_DEBUG_KEY` are both unset in production builds)

**Optional Production Verification:**
If you have `DOMAINS` and `VERCEL_TOKEN` environment variables set, you can also run production verification:

```bash
# PowerShell
$env:DOMAINS = "https://your-domain.com"
$env:VERCEL_TOKEN = "your-vercel-token"
npm run verify:prod

# Bash
export DOMAINS="https://your-domain.com"
export VERCEL_TOKEN="your-vercel-token"
npm run verify:prod
```

This verifies that deployed domains are accessible, stable, and have matching build IDs.

**Launch Status Report:**

Generate a comprehensive launch readiness report with a single command. The script auto-discovers domains from Vercel if `VERCEL_TOKEN` is set, or you can provide `DOMAINS` explicitly.

**Single-Command Launch Readiness Workflow:**

```powershell
# PowerShell
# Set VERCEL_TOKEN (auto-discovers domains) or DOMAINS explicitly
$env:VERCEL_TOKEN = "<your-vercel-token>"
# OR: $env:DOMAINS = "https://your-domain.com"

# Run launch status check with --strict mode (requires harness metrics)
npm run launch:status -- --strict

# Check exit code (0 = PASS/WARN, 1 = FAIL)
if ($LASTEXITCODE -eq 0) {
    Write-Host "Launch readiness check passed or has warnings"
} else {
    Write-Host "Launch readiness check failed - review LAUNCH_STATUS.md"
    exit $LASTEXITCODE
}
```

```bash
# Bash
# Set VERCEL_TOKEN (auto-discovers domains) or DOMAINS explicitly
export VERCEL_TOKEN="<your-vercel-token>"
# OR: export DOMAINS="https://your-domain.com"

# Run launch status check with --strict mode (requires harness metrics)
npm run launch:status -- --strict

# Check exit code (0 = PASS/WARN, 1 = FAIL)
if [ $? -eq 0 ]; then
    echo "Launch readiness check passed or has warnings"
else
    echo "Launch readiness check failed - review LAUNCH_STATUS.md"
    exit $?
fi
```

**Exit Codes:**
- `0` (PASS/WARN): All critical checks passed. May have non-blocking warnings (e.g., harness unavailable in non-strict mode).
- `1` (FAIL): Blocking issues detected. Review `LAUNCH_STATUS.md` for details.

**Report Contents (`LAUNCH_STATUS.md`):**
- Overall status (PASS/WARN/FAIL)
- Domain/build consistency results
- Debug harness metrics (failureRate + inconsistencyRate)
- Environment variable presence checks
- Blocking and non-blocking issues
- Recommended next action
- PROOF section with exact command run and redacted environment variables

**Modes:**
- **Normal mode** (`npm run launch:status`): Harness metrics are optional. Missing harness downgrades to WARN.
- **Strict mode** (`npm run launch:status -- --strict`): Harness metrics are required. Missing harness causes FAIL.

**Note:** Debug harness metrics require `VITE_DIAGNOSTICS=true` or `VITE_DEBUG_KEY` to be set for the debug routes to be accessible. In strict mode, harness unavailability will cause the check to fail.

**GitHub Actions:**
The CI pipeline (`.github/workflows/ci.yml`) automatically runs these checks on:
- Push to `main`, `master`, or `develop` branches
- Pull requests targeting these branches

The pipeline will fail if any check fails, preventing regressions from being merged.

### Accounts, API & Database (MVP)
This app includes serverless API routes (under `api/`) and a SQLite database via Prisma for minimal account support.

- Database: Prisma with SQLite (`prisma/schema.prisma`)
- API Routes:
  - `POST /api/auth/register` → { email, fullName, phone?, marketingConsent? }
  - `POST /api/auth/login` → { email }
  - `GET /api/auth/me` → current user
  - `POST /api/auth/logout` → clear session
  - `GET /api/profile` → get or create the logged‑in athlete profile (JSON blob)
  - `POST /api/profile` → save the athlete profile (JSON blob)
  - `GET /api/business/search` → business discovery (Google Places backend)
  - `GET /api/recruiting/search` → recruiting finder (filtered static dataset with server fallback)

Auth uses an HTTP‑only cookie with a signed token. For production, set a strong `AUTH_SECRET`.

#### New environment variables
- `DATABASE_URL="file:./dev.db"` (SQLite; default for local dev)
- `AUTH_SECRET="change-this-to-a-long-random-string"` (used to sign session cookies)

Optional (existing and recommended):
- Business search (server): `GOOGLE_MAPS_API_KEY` (Text Search), `GOOGLE_MAPS_REGION_BIAS` (optional, e.g., `us`)
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL`
  - If SMTP is not configured, email sending will return HTTP 503 with `{ "error": "Email not configured" }`
  - `APP_URL` is required by recruiting email tracking links

#### Set up the DB and generate the client
1) Ensure `.env` contains `DATABASE_URL="file:./dev.db"`
2) Run Prisma generate:
   - `npm run prisma:generate`
3) Create/update the SQLite schema:
   - Fast path (no migration history): `npm run prisma:push`
   - Or with migrations (recommended):
     - `npx prisma migrate dev --name init_accounts`
4) Optional: Open Prisma Studio to inspect data:
   - `npm run prisma:studio`

#### Test sign‑up/log‑in locally
1) `npm run dev` and open `http://localhost:5173`
2) Use the header buttons or the sidebar to open “Sign Up” or “Log In”
3) After registration/log‑in, you’ll be redirected to the “Athlete Profile”
   - First visit creates an empty profile in the DB
   - Saving in the Athlete Profile tab persists to `/api/profile` when logged in; if not logged in, it saves to localStorage (legacy behavior)

### Deployment
Deploy to a platform that supports both static assets and serverless (e.g., Vercel). Set `DATABASE_URL` to a persistent SQLite file or switch providers per Prisma docs. Set `AUTH_SECRET` and any SMTP variables in your host’s environment settings.


### Non‑interactive Vercel deployment (PowerShell)

Use a Vercel personal access token and run the CLI non‑interactively. The following works in CI and locally without prompts.

Prereqs:
- Create a Vercel token (`Settings → Tokens`). Store it securely.
- Have an existing Vercel Project (or specify `--project` on first link).

1) Set environment variables (PowerShell)

```powershell
# Required
$env:VERCEL_TOKEN = "<your-vercel-token>"

# Strongly recommended for non-interactive 'pull'
# Find these in Vercel → Project → Settings → General (IDs), or via `vercel projects ls`
$env:VERCEL_ORG_ID = "<your-org-id>"          # e.g. team_abc123... or user_abc123...
$env:VERCEL_PROJECT_ID = "<your-project-id>"  # e.g. prj_abc123...
```

2) Link the local directory to the Vercel Project (first time only)

```powershell
# If already linked (./.vercel exists), you can skip this
npx vercel@latest link `
  --yes `
  --token $env:VERCEL_TOKEN `
  --project "<project-name>" `
  --scope "<org-or-user-slug>"
```

Expected success pattern:
- “Linked to <org-or-user>/<project-name> (created .vercel)”

3) Pull production environment settings and generate local env files

```powershell
npx vercel@latest pull `
  --environment=production `
  --yes `
  --token $env:VERCEL_TOKEN
```

Expected success pattern:
- “Downloaded Project Settings to .vercel”
- “Created .env.production.local”

4) Build and deploy to production (non‑interactive)

```powershell
# Optional: local build, helpful to fail fast
npm run build

# Deploy to production
npx vercel@latest deploy `
  --prod `
  --yes `
  --token $env:VERCEL_TOKEN
```

Expected success patterns:
- Line containing: “Production: https://<your-prod-url>”
- Line containing: “Inspect: https://vercel.com/<org>/<project>/<deployment>”
- Exit code 0

5) Inspect deployment URL, aliases, and domains

```powershell
# Replace with the printed production URL (copy from "Production:" line)
$prodUrl = "https://<your-prod-url>"

# Inspect the deployment (aliases/domains are shown in the output)
npx vercel@latest inspect $prodUrl --token $env:VERCEL_TOKEN

# List aliases for the project (legacy) and domains on the account (current)
npx vercel@latest alias ls --token $env:VERCEL_TOKEN
npx vercel@latest domains ls --token $env:VERCEL_TOKEN
```

Expected success patterns:
- Inspect shows “Aliases” section and the deployment status as “READY”
- `alias ls` prints current aliases (if any)
- `domains ls` prints connected/custom domains on the account

Notes:
- If the project requires environment variables, ensure they are configured in Vercel (Project → Settings → Environment Variables) prior to deploy. `vercel pull` will materialize them locally for builds that need them.
- For monorepos or renamed directories, always pass the correct `--project` and `--scope` on the `link` step.
- You can replace `npx vercel@latest` with a global install (`npm i -g vercel`) and use `vercel` in commands.

#### Vercel Root Directory Configuration

**Required Setting:**
- **Vercel Root Directory**: `.` (repo root) - This must be set in Vercel Project Settings → General → Root Directory
- **vercel.json outputDirectory**: `dist` - Static files are served from `dist/`
- **API Functions**: Located at `api/` (repo root), automatically detected by Vercel as serverless functions

**Why this configuration:**
- When `outputDirectory: "dist"` is set, Vercel serves static files from `dist/`
- API functions in the root `api/` directory are automatically detected and deployed as Vercel Functions
- No manual copying is needed - Vercel natively handles both `dist/` (static) and `api/` (functions)
- Vercel Root Directory must be `.` (repo root) so that both `api/` and `dist/` are accessible

**Verification:**
After deployment, verify API endpoints return JSON:
```powershell
curl https://your-preview-url.vercel.app/api/ping
# Should return: {"ok":true}
```




