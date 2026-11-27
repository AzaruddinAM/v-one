# v-one — Accounting for every business

v-one is a Zoho-style accounting web app: **Angular 22** frontend, **Laravel 13** REST API, **MySQL** database.
It works for any kind of business — goods, services or both — with GST-ready invoicing, inventory, purchases, expenses and financial reports.

```
v-one/
├── frontend/   Angular 22 SPA (NgRx SignalStore, zoneless, lazy-loaded routes, Vitest unit tests)
├── backend/    Laravel 13 API (Sanctum tokens, multi-organization, PHPUnit tests)
└── deploy/
    ├── build-hpanel.sh   builds an upload-ready package for hPanel
    ├── templates/        .htaccess + entry point used by the package
    └── sql/              phpMyAdmin import files (empty schema / demo data)
```

---

## Features

| Area | What you get |
|---|---|
| **Login** | Mobile number + password (any format: `98765 43210`, `+91 98765-43210`), 30-day tokens, rate-limited login, self sign-up creates your organization |
| **Dashboard** | Receivables / payables with overdue, monthly sales & expenses, 12-month chart, top customers, recent transactions, low-stock alerts |
| **Contacts** | Customers & vendors, GSTIN/PAN, addresses, payment terms, opening balance, outstanding balance, transactions + account statement |
| **Items** | Goods & services, SKU, HSN/SAC, units, categories, sales & cost price, default tax, inventory tracking, opening stock, reorder level, stock adjustments |
| **Sales** | Estimates → Sales Orders → Invoices, Credit Notes; auto numbering (INV-00001…), line discounts, document discount, adjustment, live totals, print/PDF-ready tax invoice with CGST/SGST split |
| **Purchases** | Purchase Orders → Bills, Payments Made, Expenses with tax |
| **PDF templates** | Settings → PDF templates: pick Classic, Modern, Minimal or GST Tax Invoice layout, an accent colour and a footer (bank details / UPI). Every invoice, estimate and other document prints with amount in words and a signatory box; switch template per document from its toolbar, then **PDF / Print → Save as PDF** |
| **Payments** | Record full/partial payments (cash, bank, UPI, cheque, card) against invoices/bills or as advances; statuses update automatically (sent → partial → paid / overdue) |
| **Inventory** | Stock moves automatically: invoices reduce, bills & credit notes increase; draft/void documents don't touch stock; edits re-sync |
| **Accountant** | Chart of accounts (25 standard accounts pre-created), manual journals with debit = credit validation |
| **Reports** | Profit & Loss, Balance Sheet, Receivables & Payables aging, Sales by Customer, Sales by Item, GST/Tax summary, Inventory valuation — date presets, CSV export, print |
| **Settings** | Organization profile, currency, financial year, default terms; tax rates; users & roles (admin / accountant / staff); profile & password |
| **AI (Gemini)** | Scan a bill photo/PDF → review & edit the extracted vendor, items, GST and totals → confirm to save as a bill or expense; ✨ chat assistant that answers from your live data, drafts reminders and supports `/commands`. See [AI-ASSISTANT-GUIDE.md](AI-ASSISTANT-GUIDE.md) |
| **Multi-tenant** | Every organization's data is isolated automatically (global scope + scoped validation) |

### Demo login (demo SQL / seeder)

```
Mobile:   9876543210
Password: Admin@123
```
Change this password (Settings → My profile) on any real server.

---

## Deploying to Hostinger hPanel (no SSH needed)

The upload package (`v-one-hpanel-upload.zip`) already contains the built Angular app and Laravel **with its `vendor/` folder**, so you only need the File Manager and phpMyAdmin.

**1. Create the database** — hPanel → *Databases → MySQL Databases*: create a database and user, note the name, user and password (they look like `u123456789_vone`).

**2. Import the tables** — hPanel → *Databases → phpMyAdmin* → select the database → **Import** → choose
- `database/v-one-schema.sql` for a clean start (then sign up from the app), or
- `database/v-one-demo.sql` to start with the demo company.

**3. Upload the files** — hPanel → *Files → File Manager* → open `public_html` → upload `v-one-hpanel-upload.zip` → **Extract**. Move the *contents* of the extracted `public_html/` folder into your real `public_html` so you end up with:

```
public_html/
├── index.html, *.js, *.css, .htaccess     ← Angular app
└── backend/
    ├── index.php, .htaccess               ← API entry → https://yourdomain.com/backend/api
    └── core/                              ← Laravel (blocked from the web)
        └── .env                           ← edit this
```
(Enable "Show hidden files" in File Manager to see `.htaccess` and `.env`.)

**4. Configure** — edit `public_html/backend/core/.env`:
```
APP_URL=https://yourdomain.com/backend
DB_HOST=localhost
DB_DATABASE=u123456789_vone
DB_USERNAME=u123456789_vone
DB_PASSWORD=your-db-password
CORS_ALLOWED_ORIGINS=https://yourdomain.com
GEMINI_API_KEY=your-gemini-key     # optional: enables bill scanning + AI chat
```
A unique `APP_KEY` is already filled in.

> **Upgrading an existing database?** Run `database/upgrade-*.sql` files you haven't run yet in phpMyAdmin → SQL (e.g. `upgrade-2026-11-pdf-templates.sql` adds the PDF template columns).

**5. PHP version** — hPanel → *Advanced → PHP Configuration* → **PHP 8.3 or newer** (extensions `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `fileinfo`, `bcmath` are enabled by default on Hostinger).

**6. Done** — open `https://yourdomain.com` and sign in. Check `https://yourdomain.com/backend/api/health` → `{"status":"ok"}`.
After SSL is active, uncomment the HTTPS redirect lines in `public_html/.htaccess`.

> **Folder permissions:** `backend/core/storage` and `backend/core/bootstrap/cache` must be writable (755 is fine on Hostinger).
> **Different API location?** Change `apiUrl` in `frontend/src/environments/environment.ts` and rebuild.

### Rebuilding the package yourself

```bash
bash deploy/build-hpanel.sh      # needs Node 22+, PHP 8.3+, Composer
# → deploy/dist/public_html + deploy/dist/database
```

---

## Local development

**Backend** (PHP 8.3+, Composer, MySQL/MariaDB or SQLite)
```bash
cd backend
composer install
cp .env.example .env            # set DB_* (or DB_CONNECTION=sqlite)
php artisan key:generate
php artisan migrate --seed      # creates the demo company
php artisan serve               # http://localhost:8000/api
```

**Frontend** (Node 22.22+)
```bash
cd frontend
npm install
npm start                       # http://localhost:4200  (talks to http://localhost:8000/api)
```

## Tests

```bash
cd backend  && php artisan test     # 45 tests: auth, tenancy, roles, documents, stock, payments, reports, calculator, AI
cd frontend && npm test             # 43 tests: auth store, guards, interceptor, list store, totals, pipes, login form, chat commands
```

---

## Architecture notes

**State management — NgRx SignalStore.** Angular 22 is signal-first and zoneless, so the app uses NgRx SignalStore (`@ngrx/signals`) instead of classic Redux-style NgRx: same predictability and devtools-friendly structure with far less boilerplate and smaller bundles.
- `AuthStore` (root) — token, user, organization, roles; persisted to localStorage; login/register/logout via `rxMethod`.
- `LookupsStore` (root) — taxes, chart of accounts, units, payment modes; loaded once per session.
- `withPaginatedList()` — a reusable store *feature* (entities + server pagination + filters + debounced search + optimistic delete). Each list page provides its own instance, so state is isolated and freed when you leave.
- `DashboardStore` — feature store for the dashboard.

**Optimisation**
- Frontend: zoneless change detection, `OnPush` everywhere, every page lazy-loaded (initial JS ≈ 90 kB gzipped), preloading after first paint, critical CSS inlined, no UI/chart/icon libraries (custom SVG chart + inline icons), `track` in all loops, debounced search.
- Backend: indexed foreign keys and filter columns, eager loading (lazy loading is blocked in dev to catch N+1), server-side pagination with bounded page size, aggregate queries for reports, one `/lookups` call for reference data, rate limiting, optimized Composer autoloader in the package, gzip + long-term caching via `.htaccess`.

**Security** — Sanctum bearer tokens with expiry, bcrypt passwords, strong password rules, login throttling (5/min per phone+IP), per-organization data isolation, role checks (admin / accountant / staff), mass-assignment protection, validated input on every endpoint, Laravel core and `.env` blocked from the web.

**API overview** (all under `/api`, JSON, `Authorization: Bearer <token>`)
```
POST auth/register | auth/login | auth/logout     GET auth/me     PUT auth/profile | auth/password
GET  lookups      GET|PUT organization            users (admin)
taxes, accounts, contacts, items, documents, payments, expenses, journals   (REST resources)
GET  contacts/{id}/statement        POST items/{id}/adjust-stock   GET items/{id}/movements
GET  documents?type=invoice&status=&q=&from=&to=   GET documents/next-number?type=
POST documents/{id}/status          POST documents/{id}/convert
GET  reports/{dashboard|profit-loss|balance-sheet|receivables|payables|sales-by-customer|sales-by-item|tax-summary|inventory}
```

The balance sheet is a simplified management view: it is derived from documents, payments, expenses and journals, with retained earnings as the balancing figure.
