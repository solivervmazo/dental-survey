# Publish the dental survey

This repository is public. The GitHub Pages workflow publishes only `site/`. The local dashboard source is in the repository, but its database password stays in `.env` on your computer and is never deployed.

## What belongs in GitHub

Commit `site/`, `dashboard/` source, `supabase/schema.sql`, `.github/workflows/pages.yml`, `.env.example`, `generate-public-config.mjs`, `local-server.mjs`, `start-dashboard.ps1`, `README.md`, and this guide. The checked-in `site/config.js` contains only the Supabase project URL and publishable key. These values are intended for public browser code when row-level security is enabled.

Do **not** add `.env`, `node_modules/`, a Postgres connection URI, a database password, or any Supabase secret/service-role key. `.gitignore` excludes `.env` and dependencies.

## 1. Configure Supabase locally

Create a local `.env` from [`.env.example`](.env.example) with these fields:

```text
SUPABASE_URL=your project URL
SUPABASE_PUBLISHABLE_KEY=your sb_publishable_ key
SUPABASE_DATABASE_URL=your full Postgres URI
```

Use the **Session pooler** URI from Supabase **Connect** if the direct `db.<project>.supabase.co` host does not resolve on your network. Session pooler uses port 5432 and works on IPv4 networks. Put the complete URI, including the password, only in your local `.env` file.

After changing the public URL or publishable key, run `node generate-public-config.mjs`. This writes only those two public values to `site/config.js`.

## 2. Apply the database schema

Install local dashboard dependencies once:

```powershell
cd dashboard/server
npm install
cd ../..
```

Then apply the schema and row-level security policies:

```powershell
node dashboard/server/migrate.mjs
```

This creates `survey_visits` and `survey_responses`. Anonymous visitors can insert, but cannot read submissions. The dashboard reads through the local server's database connection.

## 3. Push to GitHub

Use the public repository `https://github.com/solivervmazo/dental-survey.git`:

```powershell
git add .
git commit -m "Update survey and sharing"
git remote add origin https://github.com/solivervmazo/dental-survey.git
git branch -M main
git push -u origin main
```

If `origin` already exists, use `git remote set-url origin https://github.com/solivervmazo/dental-survey.git` instead of `git remote add`. Run `git status --short` before pushing: `.env` must not appear.

## 4. Enable GitHub Pages

In the GitHub repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. The included `Publish questionnaire` workflow uploads only `site/`. If the workflow did not run after the push, open **Actions → Publish questionnaire → Run workflow**.

The expected survey URL is `https://solivervmazo.github.io/dental-survey/`. The page builds its copy link and QR code from its live URL, so they will point to this address after publication.

## 5. Open the local dashboard

From the project folder, run `node local-server.mjs` and visit `http://localhost:4173/dashboard/`. It shows page views, submissions, role counts, a seven-day trend, response details, and CSV export. The server listens on `127.0.0.1` and reads the Postgres URI from `.env`; the browser never receives that URI.

Page views are approximate because they are recorded once per browser tab session and may be blocked by network settings. Before sharing the survey, submit one sample response and confirm it appears in the local dashboard.

References: [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Supabase Postgres connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).
