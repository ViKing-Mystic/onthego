# 🛵 OntheGO - Production Deployment, Operations & Architecture Guide

This guide details the system architecture, setup procedures, database migrations, operational runbooks, backup/recovery strategies, security protocols, API cost audits, and deployment checklists for the **OntheGO** travel itinerary web app (Kochi–Alleppey Coastal Scooter Expedition, 16–20 October 2026).

---

## 1. System Architecture Summary

OntheGO is built as a **resilient, mobile-first Progressive Web App (PWA)** engineered to operate reliably in bandwidth-constrained environments (e.g., Kerala coastal backroads, Chellanam–Mararikulam beach roads, and Alleppey backwaters).

```
                                      +---------------------------------------------+
                                      |             BROWSER CLIENT (PWA)            |
                                      |                                             |
                                      |  +-------------------+  +----------------+  |
                                      |  |  UI Components    |  | Service Worker |  |
                                      |  |  (Modular Vanilla |  | (Cache-First   |  |
                                      |  |   JS Modules)     |  |  v14-prod)     |  |
                                      |  +---------+---------+  +--------+-------+  |
                                      |            |                     |          |
                                      |  +---------v---------+  +--------v-------+  |
                                      |  |  Sync Engine      |  | Security Engine|  |
                                      |  |  & Conflict Queue |  | (XSS, RateLim, |  |
                                      |  |                   |  |  MIME, PII)    |  |
                                      |  +---------+---------+  +--------+-------+  |
                                      |            |                     |          |
                                      |  +---------v---------+           |          |
                                      |  | IndexedDB Vault   |           |          |
                                      |  | (Local Authority) |           |          |
                                      |  +---------+---------+           |          |
                                      +------------|---------------------|----------+
                                                   |                     |
                              Cellular Sync / REST |                     | Rate-Limited APIs
                                                   v                     v
                        +--------------------------+----+  +-------------+-----------+
                        |  Supabase PostgreSQL DB       |  | External Services       |
                        |  - Zero-Trust RLS Policies    |  | - Google Gemini 1.5     |
                        |  - 2-Traveller Max Constraint |  | - Open-Meteo Weather    |
                        |  - Private Notes Masking View |  | - OpenStreetMap Tiles   |
                        |  - Integer Minor Units (Paise)|  |                         |
                        +-------------------------------+  +-------------------------+
```

### Core Architecture Principles:
1. **Zero-Build, Pure Web Standards**: Modern ES6+ JavaScript modules without heavy bundling overhead, eliminating build brittleness during urgent road-trip patches.
2. **Offline-First Authority**: Local state in IndexedDB (`OntheGoStorage`) and memory is the immediate source of truth. Network sync occurs opportunistically in the background.
3. **Integer Minor Unit Precision**: All currency math (INR) is computed strictly in integer paise (`₹1 = 100 paise`), preventing IEEE-754 floating-point drift across split settlements.
4. **Deterministic Safeguards over LLMs**: AI assistant recommendations from Google Gemini are strictly verified through deterministic validators before mutating the schedule, protecting hard deadlines (Day 5 Vande Bharat departure at 2:00 PM, scooter return by 1:00 PM).
5. **Zero-Trust Multi-Tenancy**: Supabase Row-Level Security (RLS) policies enforce data isolation at the database layer; client checks are never relied upon for security boundaries.

---

## 2. Setup & Local Development

### Prerequisites:
- Any modern web browser (Edge, Chrome, Safari, Firefox).
- Python 3.x, Node.js (`npx serve`), or any static HTTP file server.
- (Optional) Supabase CLI for local database emulation.

### Step-by-Step Local Setup:
1. **Clone or navigate to the repository directory**:
   ```bash
   cd d:/Documents/OntheGo
   ```

2. **Configure Environment Variables**:
   Copy the example environment template:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to provide your `GEMINI_API_KEY` (if testing live multimodal AI features) and `SUPABASE_URL` / `SUPABASE_ANON_KEY` (if testing remote cloud sync).

3. **Start a local development server**:
   ```bash
   # Using Python 3:
   python -m http.server 8000

   # Or using Node:
   npx serve . -p 8000
   ```

4. **Access the application**:
   Open `http://localhost:8000` on your desktop or mobile browser.

---

## 3. Database Migrations & Seed Scripts

The project includes production-grade PostgreSQL migrations tailored for Supabase.

### Migration Files:
- **`supabase/migrations/20261014_initial_schema_and_rls.sql`**:
  - Creates UUID-keyed tables: `trips`, `trip_members`, `trip_invitations`, `itinerary_days`, `activities`, `expenses`, `expense_splits`, `memories`, `checklists`.
  - Enforces `amount_inr_paise BIGINT NOT NULL` for all financial figures.
  - Implements `is_trip_member` and `is_trip_owner` `SECURITY DEFINER` functions.
  - Enables Row Level Security (RLS) on all 9 tables with strict member isolation.
  - Deploys `sanitized_trip_memories` view masking `private_notes` unless accessed by the memory author.
  - Deploys `redeem_trip_invitation` stored procedure enforcing the strict 2-traveller ceiling per trip.
- **`supabase/seed.sql`**:
  - Seeds the 5-day master expedition: **Kochi to Alleppey Coastal Scooter Expedition** (16–20 October 2026).
  - Populates all verified bookings, contacts (Calvin's Inn: `9995165493`, Scooter Vendor: `9003955156`), and timing constraints.

### Executing Migrations in Supabase:
```bash
# Using Supabase CLI:
supabase db push

# Or apply manually via Supabase SQL Editor:
# 1. Open Supabase Dashboard -> SQL Editor.
# 2. Paste and run supabase/migrations/20261014_initial_schema_and_rls.sql.
# 3. Paste and run supabase/seed.sql.
```

---

## 4. Production Build & Deployment Options

Because OntheGO uses native ES modules and standard PWA web technologies, it can be deployed directly to any static web host or CDN with zero compile-time dependencies.

### Deployment Targets:

#### Option A: GitHub Pages
1. Push the repository to GitHub.
2. In the repository settings, navigate to **Pages** -> **Build and deployment**.
3. Select **Deploy from a branch** -> branch: `main` / folder: `/ (root)`.
4. The PWA will be live at `https://<username>.github.io/<repo-name>/`.

#### Option B: Netlify / Cloudflare Pages / Vercel
1. Link your Git repository.
2. Build command: *(leave empty)*.
3. Publish directory: `.` (root).
4. Configure HTTP response headers (e.g., in `_headers` or `netlify.toml`):
   ```
   /*
     X-Content-Type-Options: nosniff
     X-Frame-Options: SAMEORIGIN
     Referrer-Policy: strict-origin-when-cross-origin
     Permissions-Policy: geolocation=(self), camera=(self), notification=(self)
   ```

#### Option C: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Set public directory to '.' and configure as single-page app
firebase deploy --only hosting
```

---

## 5. Backup & Disaster Recovery Plan

### Recovery Metrics:
- **Recovery Time Objective (RTO)**: `< 15 minutes`
- **Recovery Point Objective (RPO)**: `< 5 minutes` (client-side snapshot) / `0 minutes` (IndexedDB persistence)

### Client-Side Snapshot & Disaster Recovery:
1. **Local Vault Snapshots**:
   - `OntheGoStorage` stores all trips, expenses, and journal entries in browser IndexedDB.
   - Daily automatic local snapshots are created under the `snapshots` object store.
2. **Manual JSON Export/Import**:
   - Users can trigger a complete encrypted JSON backup via **More -> Settings -> Export Backup**.
   - If a device is dropped, lost, or water-damaged during the coastal scooter ride, the partner can re-import the backup or invite the replacement device using the active invitation link and 6-digit access PIN.
3. **Cloud Database Point-in-Time Recovery (PITR)**:
   - Supabase automatically maintains daily WAL (Write-Ahead Log) backups on production tiers.
   - In the event of accidental data corruption, execute a point-in-time restore from the Supabase management console.

---

## 6. Monitoring, Telemetry & Error Reporting

### Telemetry Guidelines:
1. **Privacy-Preserving Client Logging**:
   - The reliability engine (`OntheGoReliability.logError`) automatically scrubs PII (phone numbers, PNRs, credit tokens) before recording error logs in the diagnostic queue.
   - Logs are stored locally in IndexedDB and viewable under **More -> Diagnostics**.
2. **Network State Observability**:
   - Live network transitions (`online`, `offline`) update header pills immediately (`🟢 Online`, `🔴 Offline (Local IDB)`, `🟠 Pending Sync (X)`).
   - Circuit breakers automatically trip and display user-friendly notices when external APIs encounter repeated timeouts.
3. **Production APM Integration (Optional)**:
   - If Sentry or Datadog is added, configure client-side `beforeSend` hooks to scrub any geographic coordinate details not belonging to public landmarks.

---

## 7. Third-Party API Usage & Cost Analysis

The entire OntheGO application is designed to operate at **₹0.00 / month** under standard 2-traveller expedition usage:

| Service | Purpose | Quota / Free Tier Limit | Expected 5-Day Expedition Consumption | Projected Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Google Gemini 1.5 Flash** | Multimodal Assistant & Proposal Extraction | 15 Requests/Min, 1M Tokens/Min (Free) | ~35 conversational interactions | **₹0.00** ($0.00) |
| **Open-Meteo API** | Live Weather & Monsoon Forecasts | 10,000 calls/day (Free, no key required) | ~50 weather checks | **₹0.00** ($0.00) |
| **OpenStreetMap / Carto** | Map tiles & route rendering | Free public open-access tiles | ~200 tile downloads (cached in SW) | **₹0.00** ($0.00) |
| **Supabase PostgreSQL** | Cloud Database, Auth & Real-Time Sync | 500 MB DB, 50k MAU, 5 GB Bandwidth (Free) | < 10 MB DB, 2 users, < 50 MB egress | **₹0.00** ($0.00) |
| **Static Hosting (Pages/Netlify)** | PWA App Shell delivery | Unlimited / 100 GB Bandwidth (Free) | < 25 MB total app shell bandwidth | **₹0.00** ($0.00) |
| **TOTAL** | | | | **₹0.00 (Free)** |

---

## 8. Pre-Flight Deployment Checklist & Rollback Plan

### Pre-Flight Verification Checklist:
- [x] **Automated Test Suite**: `test_production_verification.html` executed with 100% pass rate.
- [x] **Service Worker Version**: Cache bumped to `onthego-v14-prod` in `sw.js` with all production assets listed.
- [x] **Accessible Viewport**: Viewport configured with text zoom enabled (`user-scalable=yes` / removed maximum scale lock).
- [x] **WCAG 2.1 AA Compliance**: All interactive buttons meet minimum 44x44px touch targets; `:focus-visible` outlines verified.
- [x] **Semantic Modal Dialogs**: `role="dialog"` and `aria-modal="true"` present on all interactive modals.
- [x] **XSS & URI Protection**: All user strings escaped via `OntheGoSecurity.escapeHTML`; `javascript:` links blocked.
- [x] **Rate Limiting**: Token bucket rate limiter configured for external API calls.
- [x] **Financial Integer Math**: All expenses, splits, and settlements computed in paise (`BIGINT`).
- [x] **Hard Deadline Locks**: Day 5 Vande Bharat train (2:00 PM) and scooter return (1:00 PM) hard constraints validated.
- [x] **Dual Traveller Boundary**: 2-traveller invitation ceiling enforced in code and database schema.

### Rollback Procedure:
If a critical defect is identified post-deployment:
1. **Frontend App Shell Rollback**:
   - **GitHub Pages**: Revert the offending commit on `main` and push; GitHub Actions re-deploys within 90 seconds.
   - **Netlify / Vercel**: Open deployment history, locate the previous green deployment, and click **Rollback / Publish Deployment** (instant atomic rollback).
2. **Service Worker Cache Purge**:
   - In `sw.js`, increment the cache version name (e.g., from `onthego-v14-prod` to `onthego-v15-rollback`).
   - The Service Worker's `activate` event will automatically flush stale caches and reload active clients.
3. **Database Schema Rollback**:
   - If a database migration fails, apply down-migrations or restore a pre-migration snapshot from the Supabase Dashboard -> Backups.
