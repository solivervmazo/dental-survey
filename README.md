# Dental duty research questionnaire

A short English and Tagalog questionnaire for dental clinic owners, receptionists, and dentists in the Philippines. It asks about existing duty scheduling practices without describing a proposed product. Questions branch by role and stop when they no longer apply. Respondents who stop early may optionally describe another day-to-day problem and an application they wish existed.

The public questionnaire lives in `site/`. Its share link and QR code use the current page address, so they point to the GitHub Pages URL after publication. The dashboard runs only on your computer through `node local-server.mjs`; it reads Supabase through a Postgres connection stored in the ignored `.env` file.

See [PUBLISHING.md](PUBLISHING.md) for setup, migration, GitHub Pages publication, and dashboard instructions.

## Repository contents

- `site/` — public static questionnaire; this is the only folder deployed to Pages
- `dashboard/` — local dashboard and its server
- `supabase/schema.sql` — database tables, access grants, and row-level security policies
- `.github/workflows/pages.yml` — GitHub Pages deployment from `main`
- `.env.example` — local configuration template, without credentials

The checked-in `site/config.js` contains only the Supabase URL and publishable key. Never commit `.env`, a database password, or a Supabase secret or service-role key.

## Analytics scope

The survey records page views once per browser tab session and submitted answers. Page views are approximate. The local dashboard shows visit and response counts, roles, a seven-day trend, recent responses, and CSV export. No patient information should be entered in responses.
