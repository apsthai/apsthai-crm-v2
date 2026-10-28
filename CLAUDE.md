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

## Before a PR
`npm run lint` and `npm run build`.
