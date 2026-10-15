# 🌴 OntheGO — Kerala Coastal Travel Companion

[![Production Verification: 100% Passed](https://img.shields.io/badge/Production%20Verification-59%2F59%20Passed%20(100%25)-3F7968.svg)](test_production_verification.html)
[![WCAG 2.1 AA](https://img.shields.io/badge/WCAG%202.1%20AA-Compliant-4D9A98.svg)](#accessibility--standards)
[![Architecture: Zero-Build ES Modules](https://img.shields.io/badge/Architecture-Zero--Build%20ES%20Modules-C7795A.svg)](#architecture)

**OntheGO** is a lightweight, mobile-first travel companion website designed for two travellers (**Vishnu** & **Co-rider**) on their 5-day coastal scooter expedition from **Kochi to Alleppey** (16–20 October 2026).

Built on pure web standards without heavy build tools or fragile dependencies, OntheGO delivers live itineraries, integer-safe shared expense splitting, route navigation, and verified backup options that remain 100% accessible even when cellular connectivity drops along Kerala's coastal roads.

---

## 🗺️ Website Structure & Information Architecture

OntheGO is structured around 9 semantic destinations with a cohesive mobile bottom navigation bar and desktop header:

| Page | Route | Description |
| :--- | :--- | :--- |
| **1. Start Page** | `/` or `#/start` | Welcoming coastal landing page introducing the app, active trip preview, primary "Open My Trip" / "Plan a New Trip" actions, and 4 core feature cards. |
| **2. Trip Dashboard** | `/trips/:tripId` or `#/overview` | Operating home with day selector, current progress (0/11 stops), upcoming activity countdown, live coastal weather widget, and "Start Today's Route" CTA. |
| **3. Itinerary** | `/trips/:tripId/itinerary` | Chronological activity timeline with travel durations, status badges (completed, skipped, upcoming), Friday closure static warnings, and editing actions. |
| **4. Explore & Backups** | `/trips/:tripId/explore` | Interactive Leaflet route map with category filters (Food, Sights, Beaches, Stays, Activities), 22+ verified dining spots, and route-aware backup planner (within 2, 5, or 10 km). |
| **5. Bookings & Essentials** | `/trips/:tripId/bookings` | Bookings vault with stays (Calvin's Inn `9995165493`, Ocean Aura `7994455407`), scooter rental agreement (`9003955156`), train tickets, and emergency contacts. |
| **6. Budget & Splits** | `/trips/:tripId/budget` | Multi-currency expense ledger, 50/50 equal splits, percentage splits, custom splits, and minimum-transfer debt settlement computed strictly in integer paise. |
| **7. Shared Trip** | `/trips/:tripId/shared` | 2-traveller collaboration hub, cryptographic access link generation with 6-digit access PIN, active persona switcher, and mutual packing checklist. |
| **8. Memories & Reports** | `/trips/:tripId/memories` | Travel journal with star ratings, photo memory preservation, private notes masking, and comprehensive trip recap report export. |
| **9. Settings & Assistant** | `/settings` & `/trips/:tripId/assistant` | Conversational travel assistant with deterministic schedule validation, Gemini API configuration, JSON backup export/import, print/PDF view, and master reset. |

---

## 🎨 Visual Design System: Coastal Kerala

The design system is inspired by Fort Kochi, Alleppey's backwaters, coastal roads, coconut palms, and sea-glass tones:

- **Primary (`#3F7968`)**: Muted sea-glass green
- **Secondary (`#4D9A98`)**: Coastal teal
- **Background (`#FAF8F2`)**: Warm ivory
- **Surface (`#FFFFFF`)**: Clean off-white
- **Accent (`#C7795A`)**: Muted terracotta
- **Supporting Neutral (`#E9DFC9`)**: Sand beige
- **Main Text (`#29332F`)**: Deep charcoal
- **Secondary Text (`#6E7973`)**: Muted grey-green
- **Borders (`#E7E5DE`)**: Subtle warm grey

---

## 🛡️ Key Reliability & Engineering Safeguards

1. **Integer Minor Unit Currency Math (Paise)**:
   - All financial figures are stored and calculated in integer paise (`₹1.00 = 100 paise`), preventing floating-point precision loss.
   - Any odd 1-paisa division remainders are deterministically allocated to the payer.
2. **Fixed Commitment & Travel Constraint Safeguards**:
   - Day 5 return Vande Bharat departure is locked at 2:00 PM (14:00).
   - Scooter return is scheduled for 1:00 PM (1:30 PM absolute cutoff).
   - Proposal engines and delay simulations strictly reject adjustments violating these deadlines.
3. **Offline Vault & IndexedDB Storage**:
   - Complete trip data is cached locally via Service Worker (`sw.js`) and IndexedDB (`OntheGoStorage`).
   - Works fully offline on coastal routes; pending offline changes are safely enqueued with unique idempotency keys.
4. **Dual-Traveller Security & Privacy**:
   - Maximum 2 travellers per trip (Vishnu & Co-rider).
   - Cryptographic invitation tokens with 6-digit PIN verification.
   - Private journal notes are strictly excluded from public shared exports.
5. **Security & Input Sanitization**:
   - HTML entity encoding via `escapeHTML()` to eliminate XSS.
   - Strict protocol filtering via `sanitizeURL()` to block `javascript:` and dangerous schemes.
   - Phone number and PII masking for sensitive contacts.
   - Client-side token bucket rate limiting.

---

## 🚀 Quick Start & Local Development

No build steps, bundlers, or npm installations are required. OntheGO runs directly in any modern browser:

```bash
# 1. Clone repository
git clone https://github.com/ViKing-Mystic/onthego.git
cd onthego

# 2. Start any local static file server
# Using Python:
python -m http.server 8000

# Or using Node:
npx serve . -p 8000

# 3. Open in browser
open http://localhost:8000
```

---

## 🧪 Automated Testing & Verification

Comprehensive end-to-end tests verify all 16 architectural pillars:

- **`test_production_verification.html`**: 60/60 tests passing (100%)
- **`test_stage7.html`**: 45/45 tests passing (100%)
- **`test_stage5.html`**: 44/44 tests passing (100%)

Run tests in any modern Chromium/Edge browser by opening the HTML test files directly, or run headlessly:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_verify.ps1 test_production_verification.html
```

---

## 🌐 Production Deployment

OntheGO is ready for instant deployment to any static hosting platform:

### Vercel
- Root directory: `./`
- Configured with `vercel.json` for SPA rewrites and security headers.

### Netlify / Cloudflare Pages
- Root directory: `./`
- Configured with `_redirects` (`/* /index.html 200`) for direct deep link routing.

### GitHub Pages
- Set source to `main` branch, `/ (root)` folder.

For full operational runbooks, Supabase migrations, and disaster recovery procedures, refer to [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 📄 License & Credits

Created for the **Kochi–Alleppey Coastal Scooter Expedition** (16–20 October 2026).
Authored by Vishnu & Co-rider.
