# Dental duty research questionnaire

Research survey for dental clinic owners/managers, receptionists/schedulers, and dentists. The questions use yes/no and single-choice answers and stop early when a branch does not apply. The public survey does not describe the proposed product or collect patient details.

For the step-by-step release guide, see [PUBLISHING.md](PUBLISHING.md).

## Files

- `site/` — public GitHub Pages questionnaire
- `dashboard/` — local-only response and visit dashboard; excluded from Pages deployment
- `supabase/schema.sql` — database tables, grants, and row-level security policies
- `.github/workflows/pages.yml` — publishes only `site/`

## Connect Supabase

1. Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
2. Under Authentication > Users, create your own dashboard account. Copy its user UUID and run the last `insert into public.survey_admins` statement in `schema.sql` with that UUID.
3. In `site/config.js`, set `SUPABASE_URL` and the project's **publishable key** (`sb_publishable_...`). The publishable key is designed for browser use; never put a secret key or service role key here.
4. The dashboard signs in with that account's email and password. Its access token is kept in browser session storage and removed when you sign out or close the tab.

## Publish on GitHub Pages

1. Push this folder to a GitHub repository with a `main` branch.
2. In the repository's Settings > Pages, set the source to **GitHub Actions**.
3. The included workflow deploys the `site/` folder. The dashboard and SQL files are not part of the public website.

## Open the dashboard locally

From this folder, run `node local-server.mjs` (or `./start-dashboard.ps1` in PowerShell) and open `http://localhost:4173/dashboard/`. The server binds to your computer only. Do not open `dashboard/index.html` directly as a file, because ES module imports need an HTTP origin.

## Analytics notes

Page views are recorded once per browser tab session when Supabase is connected. They are approximate: browser blocking, network failures, and repeated sessions affect counts. The dashboard shows up to 10,000 visits and 10,000 responses in the current version. No IP address, device fingerprint, or patient data is intentionally stored. Public submissions are possible without an account, so abuse protection may be needed if the survey is widely shared.
