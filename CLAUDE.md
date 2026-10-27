# APSthai CRM v2

Internal web app for APSthai: students, cases (lead to enrolment), receivables, invoices, payments and staff commission.
The full design is the "APSthai CRM Database Spec" doc. This repo replaces `apsthai/apsthai-crm` (v1, not used).

## Stack
- Next.js (App Router, `src/proxy.ts`), TypeScript, Tailwind CSS v4. No UI library.
- Supabase project `apsthai-crm-sg` (`qnfenbetcdqwcrlvwffr`, Singapore). Schema in `public`; the v1 tables sit in `legacy` and are not used.
- Hosting: Vercel, no env vars needed (public URL and publishable key are in `src/lib/supabase/config.ts`).

## Auth
- Staff sign in with a username. Supabase Auth gets `<username>@crm.apsthai.local` (no real mailbox, no email is ever sent).
- Logins are created and reset by an admin through the `admin-users` Edge Function. The service role key lives only there.
- Never add Google or any other OAuth provider. Never put the service role key in this repo or in Vercel.

## Rules
- All data access goes through the user's session, so RLS decides. Do not bypass it.
- Business logic lives in the database (triggers and RPCs): receivables from income terms, success approval, points,
  payouts, merge, anonymize, education roll on 1 July. The app calls `approve_success`, `revert_success`,
  `generate_payouts`, `record_payment`, `merge_students`, `anonymize_student`, `find_similar_students`.
- Change the schema only with a new Supabase migration. Every table has a ChangeLog trigger; keep it.
- "Today" is Asia/Bangkok: `today_bangkok()` in SQL, `todayBangkok()` in the app.
- UI text comes from `src/lib/dict.ts` (Thai and English). Master data shows `name_th` / `name_en`.
- Students are often under 18 (PDPA). Never commit real data or exports, never log personal data.

## Before a PR
`npm run lint` and `npm run build`.
