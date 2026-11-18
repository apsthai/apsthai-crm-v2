# APSthai CRM v2

Internal web app for APSthai: students, cases (lead to enrolment), receivables, invoices, payments and staff commission.
The database design is the "APSthai CRM Database Spec" doc. This repo replaces `apsthai/apsthai-crm` (v1, not used).

## Status
The app was cleared on 28 Oct 2026 and is being rebuilt from an empty Next.js project, one screen at a time,
designed by the owner (ครูปอง). The first build is in git history (commit `bcaea13`); do not copy from it unless asked.
The database in Supabase was kept and is the source of truth.

## How we work
- Build only the screen the owner has designed and approved. Do not add screens or features he has not asked for.
- Test every screen yourself end to end (with obviously fake TEST data, deleted afterwards) before showing it.
- Ask before adding any library.
- Anything that can be added can also be deleted while nothing else uses it yet (owner's rule, 17 Nov 2026). Show Delete only then, with a second click to confirm; once used, offer hide / switch off / cancel instead. The database foreign keys are the backstop.

## Stack
- Next.js (App Router), TypeScript, Tailwind CSS v4.
- Supabase project `apsthai-crm-sg` (`qnfenbetcdqwcrlvwffr`, Singapore). Schema in `public`; the v1 tables sit in `legacy` and are not used.
- Hosting: Vercel, region `sin1` (next to the database).

## Auth (owner's decision)
- Staff sign in with a username, no email. Supabase Auth gets `<username>@crm.apsthai.local`; no email is ever sent.
- Logins are created and reset by an admin through the `admin-users` Edge Function. The service role key lives only there.
- Never add Google or any other OAuth provider. Never put the service role key in this repo or in Vercel.

## Database rules
- All data access goes through the user's session, so RLS decides. Do not bypass it.
- Business logic lives in the database (triggers and RPCs): receivables from income terms, success approval, points,
  payouts, merge, anonymize, education roll on 1 July.
- Change the schema only with a new Supabase migration. Every table has a ChangeLog trigger; keep it.
- "Today" is Asia/Bangkok: `today_bangkok()` in SQL.
- Students are often under 18 (PDPA). Never commit real data or exports, never log personal data.

## Roles
- `staff`: own cases. `admin`: everything. `viewer` (owner-approved 18 Nov 2026, for the advisor): sees every page admin sees,
  changes nothing, never sees contact details. In the database a restrictive policy on every table refuses any insert,
  update or delete by a viewer, and contacts are closed to viewers. In the app, `seesAll(me)` opens a page to admin and
  viewer, actions stay admin-only, and `ReadOnlyGuard` disables every saving form for a viewer; mark buttons that only
  start an edit with `data-edit` so they are hidden. A new table gets the viewer policies by repeating the loop in
  migration crm_v2_viewer_role.

## Advisor connector (owner-approved 17 Nov 2026)
- `/api/mcp/[token]` is a read-only MCP connector for the organisation's advisor (Bee7). It checks `ADVISOR_MCP_TOKEN`
  and connects to Postgres as `advisor_ro` via `ADVISOR_DATABASE_URL` (the `pg` library), never with Supabase keys.
- `advisor_ro` can only SELECT the views in schema `analytics` (default privileges grant new views automatically).
  The grant is the real guard; never grant it anything in `public`. Each query also runs alone in a READ ONLY transaction.
- The views run as their owner, so the advisor sees what the owner sees, EXCEPT contact details: never put phone, email,
  LINE, date of birth, parents / guardians, family payer names, referrer names or usernames in `analytics`.
  Change the views only with a migration.
- Never log query text, parameters or rows from the connector. Tool errors go back to the caller, not to logs.

## Before a PR
`npm run lint` and `npm run build`.
