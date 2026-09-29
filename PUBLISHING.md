# Publish the dental duty research survey

The public survey is in `site/`. The owner dashboard remains local in `dashboard/` and is excluded from the GitHub Pages deployment.

## 1. Create the Supabase database

1. In [Supabase](https://supabase.com/dashboard), create a project for this survey or select a project you deliberately want to use.
2. Open **SQL Editor** and run the complete contents of [`supabase/schema.sql`](supabase/schema.sql). It creates the response and visit tables, with row-level security so public visitors can submit but cannot read responses.
3. Under **Authentication → Users**, create your dashboard user. Copy that user's UUID.
4. In SQL Editor, run:

   ```sql
   insert into public.survey_admins (user_id)
   values ('PASTE_YOUR_AUTH_USER_UUID_HERE');
   ```

5. In **Project Settings → API** or the project's **Connect** dialog, copy the project URL and **publishable** key.
6. Paste those two values into [`site/config.js`](site/config.js). Never use a secret key or service-role key in a browser file.

The public website can now submit answers through Supabase. The local dashboard can read them only after your admin user signs in.

## 2. Create and publish the GitHub Pages site

1. In [GitHub](https://github.com/new), create an **empty** repository (do not add a README or license there). `dental-duty-research` is a suggested name. Public repositories work with GitHub Pages on GitHub Free; private repositories require an eligible paid plan.
2. After editing `site/config.js`, run the commands below from this folder. Replace `YOUR_USERNAME` and the repository name if needed:

   ```powershell
   git add site/config.js
   git commit -m "Connect Supabase project"
   git remote add origin https://github.com/YOUR_USERNAME/dental-duty-research.git
   git push -u origin main
   ```

   This folder already has the first local Git commit. If `origin` already exists, use `git remote set-url origin <your-repository-url>` instead of `git remote add`.

3. In the GitHub repository, open **Settings → Pages**. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Open the **Actions** tab. If the `Publish questionnaire` workflow did not start after enabling Pages, select it and choose **Run workflow**.
5. After the workflow succeeds, the survey URL will appear in **Settings → Pages**. For a normal project repository it usually has the form `https://YOUR_USERNAME.github.io/dental-duty-research/`.

The workflow uploads only `site/`, so the dashboard is not deployed. The GitHub repository itself can still contain the dashboard source and SQL setup files.

## 3. Open your dashboard on this computer

1. From the project folder, run `node local-server.mjs` in a terminal.
2. Open [http://localhost:4173/dashboard/](http://localhost:4173/dashboard/).
3. Sign in with the Supabase Auth user from step 1. The dashboard shows page views, submitted responses, completion counts, role totals, a seven-day trend, and CSV export.

The dashboard is protected by Supabase authentication and database policies. Keep your account password private. Closing the browser tab removes its session token.

## 4. Before sharing the link

Open the published survey once, choose a role, and submit a sample response. Then open the local dashboard and confirm the sample response appears. Page-view numbers are approximate because they count browser tab sessions and may miss blocked requests.

References: [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
