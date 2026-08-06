# BRU Stock Movements — Inter-Location Inventory Tracker

Internal tool for BRU Specialty Coffee to track stock movements between BRU1 and BRU2. Staff log daily transfers (primarily BRU1 → BRU2), admins see cost analytics and movement trends.

## IMPORTANT: Always Push to Production

Every change MUST be committed and pushed to GitHub immediately. The user only tests on the live production site — never on localhost. After any code or data change:
1. Type-check (`npx tsc --noEmit`)
2. `git add` + `git commit` + `git push origin main`
3. If database data was changed locally, also apply the same change to the production Neon DB

Never leave changes in local-only state. Both Vercel (frontend) and Render (backend) auto-deploy on push.

## Business Context

BRU operates two locations. BRU1 is the primary hub — most inventory flows from BRU1 to BRU2 daily. Occasionally items return from BRU2 to BRU1. Moved items include both raw ingredients (coffee, milk, supplies) and finished products produced at BRU1 (pastries, prepared food).

BRU2 "buys" produced items from BRU1 at COGS + a global markup percentage. Raw ingredients and non-produced items transfer at cost (no markup). This creates an internal transfer pricing model that the app tracks automatically.

## Business Rules

### Movements

- A **movement** is a delivery note (albarán) — a document with a date, direction, who logged it, and line items
- **Direction:** BRU1 → BRU2 (primary, ~95% of movements) or BRU2 → BRU1 (returns/occasional)
- **Frequency:** Daily — staff log movements as they prepare deliveries
- **Workflow:** Sender logs the movement before delivery (BRU1 staff packs and logs, then delivers)
- Each line item records: item, quantity, unit, and the cost is calculated automatically
- A movement can be edited or deleted within 24 hours by the person who created it; admins can edit/delete any movement at any time
- Movements are timestamped and attributed to the logged-in user
- **Photo attachment:** Each movement can have one photo (optional). On mobile, the camera opens directly for a quick snap. Photos are compressed/resized on upload (~200-500KB) and stored on Render's persistent disk. Served via API endpoint

### Items & Catalog

- This app maintains its **own item catalog**, independent from Escandallos
- Items have: name, category, unit (from the unit system), cost per unit, and a flag indicating whether they are "produced" (made at BRU1)
- **More granular than Escandallos:** e.g., individual coffee types (Ethiopia Yirgacheffe, Colombia Huila, etc.) instead of aggregated "cafe" entries. Different bag sizes (1kg, 200g) are separate items
- Items can exist here that don't exist in Escandallos (retail coffee types, specific finished products)
- Items can be active or inactive (soft delete — inactive items don't appear in the movement form but remain in historical data)
- New items can be added by admins at any time

### Cost Sync with Escandallos

- Admin action to **sync costs from the Escandallos API** — pulls current ingredient costs and updates matching items in this app
- Sync is manual (admin-triggered), not automatic — avoids hard dependency on Escandallos being available
- Items are matched by name (fuzzy matching with admin confirmation, same pattern as Escandallos invoice import)
- Items that don't exist in Escandallos (e.g., specific coffee types) keep their manually-set costs
- Sync updates cost per unit only — it does not create or delete items
- When costs update (via sync or manual edit), historical movements retain their original costs (cost is snapshot at time of movement)

### Markup (Internal Transfer Pricing)

- **Produced items** (items BRU1 makes — pastries, prepared food, etc.) are transferred at **COGS + a global markup %**
- Current markup is **50%** — COGS come from Escandallos recipe costs
- The markup percentage is a single global setting configurable by admins in settings
- **Non-produced items** (raw ingredients, retail coffee, supplies) transfer at cost (0% markup)
- The transfer price is calculated automatically: `transfer_price = cost_per_unit * (1 + markup_pct / 100)` for produced items
- The markup % and whether an item is "produced" are set per item in the catalog
- Cost snapshot on movement: the cost and transfer price at the time of logging are saved with the movement line item, so historical data reflects the price at that moment

### Categories

- Items are organized into categories for filtering and analytics
- Categories will be determined from historical data (Excel import) cross-referenced with Escandallos categories
- Categories are admin-managed (CRUD) — can be added, renamed, or deactivated
- Examples likely include: Cafe, Lacteos, Panaderia, Bebidas, Snacks, Retail, etc.

### Units

Same unit system as Escandallos:

| Family | Units | Conversions |
|---|---|---|
| Weight | kg, g, mg | 1 kg = 1000 g = 1,000,000 mg |
| Volume | litro, ml, cl | 1 litro = 1000 ml = 100 cl |
| Count | unidad | No conversion |

Each item defines its movement unit (the unit used when logging movements).

## Auth

- **Same model as Checklists:** name grid + 4-digit PIN login
- **Roles:** admin (full access) and staff (log movements, view own history)
- **Small user set** — only staff who handle stock movements have accounts
- Token stored in localStorage as `bru_movements_token`
- Default admin seeded on first run

## Pages & Navigation

### Staff Pages

| Route | Purpose |
|---|---|
| `/` | Home — quick-access to log a new movement + today's movement summary |
| `/login` | Name grid + PIN pad (same as Checklists) |
| `/movimientos/nuevo` | New movement form — select direction, add line items (item + qty), submit |
| `/movimientos` | Movement history with calendar view — month grid highlights days with movements, click to filter; direction filter pills below |
| `/movimientos/[id]` | Movement detail — view/edit (add items, change quantities, upload photo) |

### Admin Pages

| Route | Purpose |
|---|---|
| `/admin` | Dashboard — key metrics with month selector (arrows to navigate), cost/movement/markup/personnel cards, top items, category comparison |
| `/admin/analytics` | Charts — monthly cost bar, combined cost (movements+personnel+rent) stacked bar, category doughnut, direction split, markup profit (green bars) |
| `/admin/items` | Item catalog — CRUD, cost editing, produced flag, Escandallos sync. Accent-insensitive search |
| `/admin/categories` | Category management — CRUD |
| `/admin/team` | User management — CRUD + PIN reset |
| `/admin/personnel` | Personnel cost calculator — E2N ratio BRU1/BRU2, calculates BRU2 share of salary |
| `/admin/settings` | Global settings — markup %, Escandallos API URL |

### Navigation

- **Mobile:** Bottom tab bar (Home, Movements, Admin — admin tab only for admin role)
- **Desktop:** Sidebar navigation
- Same `AppShell` pattern as Escandallos and Checklists

## Analytics (Admin)

### Key Metrics (Dashboard)

- Total cost of movements this month vs last month (with % change)
- Total number of movements this month vs last month
- Top 5 items by cost this month
- Top 5 items by quantity this month
- **Category comparison:** cost per category this month vs last month — shows each category with its current total, previous total, and % change (up/down indicators). Quick visual to spot which categories are growing or shrinking

### Charts (Analytics Page)

- **Monthly cost totals:** Bar chart showing total movement cost per month (last 12 months)
- **Category breakdown:** Doughnut/pie chart showing cost distribution by category (current month, with period selector)
- **Item-level trends:** Line chart showing movement quantity over time for selected items
- **Direction split:** BRU1→BRU2 vs BRU2→BRU1 cost comparison
- **Markup impact:** How much of the total cost is markup vs base COGS
- Charts use **Chart.js** — lightweight, free, renders client-side
- All charts support date range filtering (this month, last month, last 3 months, last 6 months, last 12 months, custom range)

## Tech Stack (same as Escandallos & Checklists)

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 → Vercel (free)
- **Backend:** FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Alembic → Render (free)
- **Database:** Neon PostgreSQL (production, free tier, EU Frankfurt) / SQLite (local dev)
- **Charts:** Chart.js (via direct integration, no wrapper library)
- **Tests:** pytest + httpx + pytest-asyncio
- **Total hosting cost:** 0 EUR

## Branding

- **Brand:** BRU Specialty Coffee
- **Canonical color:** #861A22 (brand maroon)
- **Color palette:** Maroon (#861A22), dark maroon (#6B151D), light maroon (#F8F0F1), black (#1A1A1A), warm beige (#D4C3A5)
- **Fonts:** EB Garamond (display/headings) + DM Sans (body/UI) via `next/font/google`
- **Logo:** Brand assets already in this project's `Branding/` folder (SVGs, PDFs, PNGs)
- **Icons:** Inline SVG (no icon library)

## UI Language

The entire UI is in **Spanish**. All labels, messages, placeholders, button text, and content must be in Spanish. Currency is **CHF** (Swiss Francs).

## Architecture

```
BRU1-BRU2/
├── CLAUDE.md                # This file — business rules and project context
├── PLAN.md                  # Implementation plan (to be created)
├── render.yaml              # Render deploy config
├── Branding/                # Brand assets (copied from Checklists)
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx     # Home — new movement + today's summary
│   │   │   ├── globals.css
│   │   │   ├── login/
│   │   │   ├── movimientos/
│   │   │   │   ├── page.tsx         # Movement list
│   │   │   │   ├── nuevo/page.tsx   # New movement form
│   │   │   │   └── [id]/page.tsx    # Movement detail
│   │   │   └── admin/
│   │   │       ├── layout.tsx       # Admin shell with sub-nav
│   │   │       ├── page.tsx         # Dashboard with metrics
│   │   │       ├── analytics/       # Charts and graphs
│   │   │       ├── items/           # Item catalog CRUD
│   │   │       ├── categories/      # Category CRUD
│   │   │       ├── team/            # User management
│   │   │       ├── settings/        # Global settings
│   │   ├── components/
│   │   │   ├── AppShell.tsx
│   │   │   ├── AuthGuard.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   ├── CalendarView.tsx
│   │   │   ├── ItemSelectorModal.tsx
│   │   │   ├── PinPad.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── charts/             # Chart.js wrapper components
│   │   └── lib/
│   │       ├── api.ts               # apiFetch<T>(), apiFetchBlob() with auth
│   │       ├── types.ts             # TypeScript interfaces
│   │       └── format.ts            # Currency/quantity formatters
│   └── public/
│       ├── logo/
│       ├── icons/
│       └── manifest.json
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py              # Auto-detects SQLite vs Postgres
│   │   ├── models.py                # User, Category, Item, Movement, MovementLine
│   │   ├── schemas.py               # Pydantic schemas
│   │   ├── auth.py                  # PIN hashing + JWT
│   │   ├── seed.py                  # Default admin + initial categories
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── items.py
│   │       ├── categories.py
│   │       ├── movements.py
│   │       ├── analytics.py
│   │       ├── users.py
│   │       ├── sync.py              # Escandallos cost sync
│   ├── app/services/
│   │   ├── costes.py                # Cost + markup calculation
│   │   └── analytics.py             # Aggregation queries for charts
│   ├── tests/
│   ├── alembic/
│   ├── start.sh
│   └── requirements.txt
└── docs/
    └── superpowers/
        └── specs/
```

## Database Models

### User
- id, name, pin_hash, role (admin/staff), is_active, created_at

### Category
- id, name, position, is_active, created_at

### Item
- id, name, category_id (FK), unit (kg/g/litro/ml/cl/unidad), cost_per_unit (CHF), is_produced (bool), escandallos_name (nullable — for sync matching), is_active, created_at, updated_at

### Movement
- id, direction (enum: BRU1_TO_BRU2, BRU2_TO_BRU1), created_by (FK User), notes (optional text), photo_filename (nullable — stored on Render persistent disk), movement_date, created_at, updated_at

### MovementLine
- id, movement_id (FK), item_id (FK), quantity, unit, cost_per_unit_snapshot, markup_pct_snapshot, transfer_price_snapshot, created_at

### Settings
- id, key, value (key-value store for global settings: markup_pct, escandallos_api_url)

### CostHistory
- id, item_id (FK), old_cost, new_cost, changed_at, change_source (manual/sync)

### PersonnelCost
- id, year, month, total_paid, bru1_e2n, bru2_e2n, ratio (calculated), bru2_cost (calculated), notes, created_at
- Unique constraint on (year, month)

## API Endpoints

### Auth
- `POST /api/auth/login` — name + PIN → JWT token
- `GET /api/auth/me` — current user
- `GET /api/auth/users` — public, names only (for login screen)

### Items (admin)
- `GET /api/items` — list all (with category, filterable)
- `POST /api/items` — create
- `PUT /api/items/:id` — update
- `DELETE /api/items/:id` — soft delete (set inactive)

### Categories (admin)
- `GET /api/categories` — list all
- `POST /api/categories` — create
- `PUT /api/categories/:id` — update
- `DELETE /api/categories/:id` — soft delete

### Movements
- `GET /api/movements` — list with filters (date range, direction, user)
- `GET /api/movements/calendar` — per-date movement counts for a month (params: year, month, direction)
- `POST /api/movements` — create movement with line items (multipart form for photo upload)
- `GET /api/movements/:id` — detail
- `PUT /api/movements/:id` — edit (within rules)
- `DELETE /api/movements/:id` — delete (within rules)
- `GET /api/movements/:id/photo` — serve the movement photo
- `POST /api/movements/:id/photo` — upload/replace photo

### Analytics (admin)
- `GET /api/analytics/summary?year=&month=` — dashboard metrics (selected or current month vs previous)
- `GET /api/analytics/monthly` — monthly cost totals (last 12 months)
- `GET /api/analytics/monthly-combined` — combined cost (movements + personnel + rent)
- `GET /api/analytics/markup` — monthly markup profit totals (COGS vs transfer price)
- `GET /api/analytics/categories` — cost breakdown by category (date range)
- `GET /api/analytics/items` — item-level trends (date range, item filter)
- `GET /api/analytics/direction` — BRU1→BRU2 vs BRU2→BRU1 split

### Personnel (admin)
- `GET /api/personnel/` — list all monthly personnel cost records
- `POST /api/personnel/` — create/upsert month record (auto-calculates ratio + BRU2 cost)
- `GET /api/personnel/{year}/{month}` — get specific month
- `DELETE /api/personnel/{year}/{month}` — delete

### Sync (admin)
- `POST /api/sync/escandallos` — pull costs from Escandallos API, return matched items for confirmation
- `POST /api/sync/confirm` — apply confirmed cost updates

### Users (admin)
- `GET /api/users` — list all
- `POST /api/users` — create
- `PUT /api/users/:id` — update
- `DELETE /api/users/:id` — deactivate
- `PUT /api/users/:id/pin` — reset PIN

## Running Locally

```bash
# Backend (port 8002 to avoid conflict with Escandallos on 8000 and Checklists on 8001)
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8002

# Frontend
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:8002 npm run dev
# → http://localhost:3002

# Default admin: name="Admin", PIN="0000"

# Tests
cd backend && source venv/bin/activate && pytest tests/ -v
```

## Deploy

- **Neon:** Project `BRU1-BRU2` (restless-wind-84518844), EU Frankfurt, org `org-nameless-math-59260159`
- **Render:** Service `bru1-bru2-api`, auto-deploys on push. Env: `DATABASE_URL`, `CORS_ORIGINS`, `SECRET_KEY`
- **Vercel:** Project `bru1-bru2` under `bruteam`, auto-deploys on push. Env: `NEXT_PUBLIC_API_URL`
- **GitHub:** https://github.com/felipefernandezlobato/BRU1-BRU2

### Data sync
When items/prices change locally, sync to Neon production DB. Use the import scripts in `backend/scripts/` or direct Python with the Neon connection string.

### Item naming
All item names are ASCII — no accents/tildes. Search is accent-insensitive (NFD normalization). Coffee names follow Escandallos naming: `{Origin} {Variety} {size}` (e.g., "Ethiopia By Dabov 1kg", "COE Mexico 130g").

## Key Constraints

- Must be 100% free to host and run (no paid APIs, no paid databases, no paid hosting)
- **Mobile-first** — staff primarily use phones to log movements. PWA-enabled (manifest.json, standalone display, iOS safe areas) same as Checklists
- All UI in Spanish, currency in CHF
- Cost snapshots on movements — historical data always reflects prices at time of logging
- No hard dependency on Escandallos — sync is optional and admin-triggered
- Data import/export handled directly via Claude Code sessions (no in-app import/export UI)

## Backlog (not in v1)

- Barcode/QR scanning for items
- Automated recurring movements (templates for daily standard deliveries)
- Push notifications when movement is logged
- Integration with Checklists app (e.g., "stock received" as a checklist item)
- Multi-period comparison analytics (year-over-year)
- Budget/target setting per category with alerts
- Supplier tracking on items
- Print delivery notes (PDF)

## Reference

- Escandallos: `~/projects/Tests/Escandallos` (same architecture, source for cost sync)
- Checklists: `~/projects/Tests/Checklists` (same architecture, auth pattern reference)
- Branding assets: `Branding/` folder
