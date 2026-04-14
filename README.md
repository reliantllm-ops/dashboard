# Engineering Dashboard

A lightweight static dashboard for tracking engineering delivery, reliability, and team health.

## Open locally

Open `index.html` directly in a browser.

## Deploy

### Vercel

1. Create a new Vercel project from this folder or from a Git repository containing these files
2. Framework preset: `Other`
3. Build command: leave blank
4. Output directory: `.`

### Netlify

1. Create a new site from this folder or from a Git repository containing these files
2. Build command: leave blank
3. Publish directory: `.`

### GitHub Pages

This repo includes `.github/workflows/deploy-pages.yml`, so GitHub Pages can deploy automatically from GitHub Actions.

1. Create a GitHub repository and push this folder to the `main` branch
2. In GitHub, open `Settings` -> `Pages`
3. Under `Build and deployment`, set `Source` to `GitHub Actions`
4. Push to `main` and wait for the `Deploy GitHub Pages` workflow to finish

Your site will then be available at:

`https://<your-github-username>.github.io/<repository-name>/`

## Current sections

- Executive metrics
- Deployment throughput
- Incident watch
- Squad operating view
- Engineering risks

## Next steps

- Replace mock data in `app.js` with API responses from Jira, GitHub, PagerDuty, and CI systems
- Add filtering by team, time window, and environment
- Add authentication if the dashboard will expose internal engineering data
