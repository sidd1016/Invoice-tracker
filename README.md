# Invoice Profit Tracker

A lightweight tool for tracking sales, purchase prices, profit, and GST across
multiple companies, clients, and invoices — built to run entirely on free-tier
hosting.

## Stack

| Layer            | Tech                                   |
|-------------------|-----------------------------------------|
| Frontend          | React + Vite, Tailwind CSS, Recharts    |
| Backend           | Node.js + Express                       |
| Database          | Supabase Postgres                       |
| File storage      | Supabase Storage (optional)             |
| Frontend hosting  | Vercel                                  |
| Backend hosting   | Render (free web service)               |

`backend/` and `frontend/` are independent apps — deploy each separately.

## What's implemented

- Single hardcoded login (`admin` / `admin123` by default, override via env vars) — no signup/OTP/social login.
- Home dashboard: company cards with sales/purchase/profit/invoice/client counts, FY + month filters.
- Company dashboard: KPIs (sales, purchase, gross profit, margin, GST collected/paid), recent invoices, top clients.
- Upload flow: pick/add client → invoice number & date → upload Excel → parsed preview with validation → save.
- Downloadable Excel template (extra columns like Remarks/Discount are ignored, not rejected).
- Duplicate detection on **company + client + invoice number**, with Replace / Save-as-new-version / Cancel.
- Client page with month filter and invoice list.
- Invoice detail page with items, summary, edit-ready data, delete, and original-file re-download (if Storage is configured).
- Reports: monthly, client-wise, product-wise, GST summary, with charts and one-click Excel export.
- Global search across invoice number, client name, product name.
- Payment tracking: optionally record an advance payment (amount + date) while creating an invoice, then log further payments received afterwards (installments) from the invoice detail page — each payment tracked separately with its own date. Shows total received and balance due per invoice, correctly measured against the GST-inclusive amount the customer actually owes.
- Client-level payment history: from any client page, "View payment history" shows every payment across all of that client's invoices in one place, with total invoiced, total received, and balance due.
- GST-aware profit accounting: profit is calculated on GST-exclusive prices (never counts tax as income), while amounts owed/received for payment tracking use the GST-inclusive total. Reports show GST collected, GST paid (input credit), and net GST payable.

## 1. Set up Supabase (database + storage)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run `backend/db/schema.sql` once — this creates the five tables (`companies`, `clients`, `invoices`, `invoice_items`, `invoice_payments`).
   - Already have the database set up from before? Just run `backend/db/migrations/002_invoice_payments.sql` instead — it only adds the new `invoice_payments` table.
3. *(Optional, for re-downloading original uploaded files)*: go to **Storage** → create a bucket named `invoice-files` (private is fine).
4. Grab these values for the backend `.env`:
   - **Project Settings → Database → Connection string (URI)** → `DATABASE_URL` (use the "Transaction pooler" URI on port `6543` so it works well on Render's free tier).
   - **Project Settings → API → Project URL** → `SUPABASE_URL`
   - **Project Settings → API → service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — backend only, never expose to the frontend).

## 2. Run the backend locally (optional, to test first)

```bash
cd backend
cp .env.example .env      # fill in DATABASE_URL at minimum
npm install
npm run dev                # http://localhost:4000
```

Check `http://localhost:4000/api/health` returns `{ "ok": true }`.

## 3. Deploy the backend to Render

1. Push this repo to GitHub.
2. In Render: **New +** → **Blueprint**, point it at the repo (it will read `backend/render.yaml`).
   - Or manually: **New +** → **Web Service**, root directory `backend`, build command `npm install`, start command `npm start`, plan **Free**.
3. Set the environment variables listed in `backend/.env.example` (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, `CORS_ORIGIN`).
4. Once deployed, note the URL, e.g. `https://invoice-tracker-api.onrender.com`.

Render's free web services sleep after inactivity — the first request after idle can take ~30–60s to wake up. That's expected on the free tier.

## 4. Deploy the frontend to Vercel

1. In Vercel: **Add New → Project**, import the same repo, set **root directory** to `frontend`.
2. Framework preset: Vite (auto-detected).
3. Add environment variable `VITE_API_URL` = `https://<your-render-backend>.onrender.com/api`.
4. Deploy. Once live, set `CORS_ORIGIN` on the Render backend to your Vercel URL (e.g. `https://invoice-tracker.vercel.app`) and redeploy the backend so only your frontend can call it.

## 5. First login

Visit your Vercel URL, log in with the admin credentials you set, add your first company, and upload an invoice using the downloadable template.

## Notes on the Excel template

Required columns: `Product Name`, `HSN`, `Quantity`, `Buy Price`, `Sell Price`, `GST %`.
Any other columns (Remarks, Discount, Transport, Notes, etc.) are ignored automatically — they won't cause the import to fail.

## Extending this later

The schema and API were kept intentionally minimal per the brief (no ledgers, inventory, payments, or multi-user permissions). If you outgrow the free tiers or need more features, the natural next steps are: pagination on large invoice lists, a proper edit-items UI on the invoice detail page (the API already supports `PUT /api/invoices/:id`), and role-based auth if you need more than one user.
