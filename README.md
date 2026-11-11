# TravelTrax

Personal travel expense and loyalty-points tracker. Next.js 16 + TypeScript + Tailwind 4 + Supabase.

Without Supabase keys the app runs in **demo mode**: sample trips are pre-loaded and data is stored in the browser only.

```bash
npm install
npm run dev        # http://localhost:3000
```

## Pages

| Route         | Purpose |
|---------------|---------|
| `/login`      | Email + password sign in / sign up (Supabase Auth) |
| `/`           | Dashboard: cash, points and trip totals, spending by year (click a bar to filter), by category, points by program, trip cards with a year filter, new trip, export |
| `/trips/[id]` | Trip detail: totals, guided **Add expense** flow (category → dates for flights & hotel, with "use trip dates" → cash, points, fees (+ baggage per flight) and program → review), "Next up" prompts for flights and hotel, tap any entry to edit, points by program, export |

## Database

Defined in [`supabase/schema.sql`](supabase/schema.sql).

- **trips**: `id, user_id, name, destination, start_date, end_date, notes, created_at`
- **expenses**: `id, user_id, trip_id → trips (cascade delete), category, description, amount (USD cash), points, fees (USD taxes & fees paid in cash), baggage (USD), program, expense_date, end_date (hotel check-out), entry_type, created_at`

Categories (V1): Flights, Hotel, Transportation, Activities & events, Food, shopping & other. Older `food` / `shopping` rows are shown as "Food, shopping & other". Flights are saved as a departing and a return entry (or one entry for one-way). A trip can have any number of flights and hotels.

Existing databases: run `supabase/migrations/002_expense_end_date.sql` and `supabase/migrations/003_expense_fees.sql` (fees + baggage) once each.

Every expense has Cash, Points and Fees (taxes & fees paid in cash); each flight also has Baggage. Dollars spent = cash + fees + baggage. Each flight has its own points program, picked from the 20 most common programs or typed in.

Destination search uses OpenStreetMap place data from photon.komoot.io (no API key).

Row-level security restricts each user to rows where `user_id = auth.uid()`. Expenses can only be attached to the user's own trips.

### Avoiding double counting

Each category in a trip is calculated with this rule (in `src/lib/calc.ts`):

| `entry_type`     | Meaning | Counted when |
|------------------|---------|--------------|
| `transaction`    | One purchase ($45 dinner) | the category has **no** category total |
| `category_total` | The complete total for the category | always. If one exists, transactions in that category are shown as “included” and not added again |
| `additional`     | Unitemized spending on top of transactions | the category has **no** category total |

Points follow the same rule. If itemized entries add up to more than a category total, the app shows a warning.

## Setup: Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New query**, paste the contents of `supabase/schema.sql` and click **Run**.
3. Go to **Authentication → Sign In / Providers** and make sure **Email** is enabled. You can turn off **Confirm email** to sign in right after signing up, or leave it on.
4. Go to **Project Settings → API** (or **API Keys**) and copy the **Project URL** and the **anon / publishable** key.
5. Run `cp .env.example .env.local`, fill in both values, then restart `npm run dev`. You'll be sent to `/login`.
6. Create an account. If the dashboard is empty, click **Load sample trips** to explore, or start entering trips.

## Setup: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** and import this GitHub repo. Vercel detects Next.js automatically.
2. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then click **Deploy**.
3. In Supabase, open **Authentication → URL Configuration**:
   - Set **Site URL** to your Vercel URL (e.g. `https://traveltrax.vercel.app`).
   - Add `http://localhost:3000` under **Redirect URLs** for local development.
4. On iPhone, open the site in Safari → **Share → Add to Home Screen** to use it like an app.

Vercel deploys production from the default branch, so merge to `main` to publish.

## Not in Version 1

Not included: AI features, automatic categorization, bank or Gmail integrations, budgets or forecasts, planned-vs-actual tracking, currency conversion, receipt scanning, PDF parsing, and point valuations.
