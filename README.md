## Athlete Ledger (formerly Monster Collective)

### Project summary
Athlete Ledger is a Vite + React app that matches NIL-ready student‑athletes (middle/high school) with local and regional businesses. It includes an Athlete Profile Builder (multi‑sport, multi‑position, multiple social handles and content styles) and Business Discovery via URL import and embedded external search (Yelp or proxy). A built‑in NIL Hub provides educational resources, including a link to the Skool community.

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


### Features
- **Athlete Profile Builder**: multi‑sport, multi‑position, social handles, content styles.
- **Business import from URL (auto‑scrape)**: pulls title, description, social links, and basic signals.
- **Embedded business search (Yelp/API)**: direct Yelp Fusion API or a server‑side proxy.
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
- `src/services/providers/yelpProvider.ts`: Yelp search provider (direct or via proxy)
- `src/utils/importer.ts`: URL importer (auto‑scrape)
- `src/utils/analysis.ts`: fit/level heuristics
- `src/config/env.ts`: runtime env configuration and feature gating

### Setup & install
1) **Clone**
   - `git clone <your-repo-url>`
   - `cd monster-collective`
2) **Install dependencies**
   - Using npm (recommended, `package-lock.json` present): `npm install`
3) **Environment variables**
   - Copy `.env.example` to `.env` and adjust values (see below).
4) **Run the dev server**
   - `npm run dev`
   - App runs on `http://localhost:5173` by default.

### Environment variables
Defined in `.env` (Vite only exposes `VITE_`‑prefixed vars to the client):
- `VITE_BUSINESS_SEARCH_PROVIDER` (default: `mock`)
  - Which provider to use for business search: `mock` or `yelp`.
- `VITE_YELP_API_KEY` (optional)
  - Yelp Fusion API key for direct browser calls (not recommended for production). If using this, expect CORS limitations and never commit real keys.
- `VITE_YELP_PROXY_URL` (optional, recommended for prod)
  - If set, the client calls your server‑side proxy and does NOT send the API key from the browser. Example: `https://your-domain.com/api/yelp/search`.

See `src/config/env.ts` for how these are read and used at runtime.

### Run & build
- **Dev**: `npm run dev`
- **Build**: `npm run build` (outputs to `dist/`)
- **Preview (static server)**: `npm run preview`
- **Tests**: none configured at this time.

### Deployment
This is a client‑side Vite SPA and is best deployed to a static host.

- **Recommended platforms**: Vercel, Netlify, Cloudflare Pages, GitHub Pages (static hosting).
- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Start command**: not required for static hosts. For container/dyno previews only: `npm start` (runs `vite preview`).
- **Environment variables**: Set all required `VITE_...` vars in the host dashboard. Vite inlines these at build time.

Notes on integrations:
- **Yelp integration**: For production, prefer a server‑side proxy by setting `VITE_YELP_PROXY_URL` so the client never sends secrets and to avoid CORS. If you instead set `VITE_YELP_API_KEY` for direct browser calls, expect potential CORS blocks and understand the key will be exposed to users.

There are no dynamic API routes in this project; it is a pure SPA. Keep secrets in the host’s environment configuration—never commit real keys.


