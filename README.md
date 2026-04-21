# Engineering Workspace

An editable engineering workspace with wiki-style pages, Firebase-ready cloud sync, and Google sign-in support.

## Open locally

Open `index.html` directly in a browser.

## Smoke tests

Use the smoke suite after UI or behavior changes to catch basic regressions.

1. Run `npm install`
2. Run `npx playwright install`
3. In one terminal, run `npm run serve:test`
4. In a second terminal, run `npm run test:smoke`

What it checks:

- App loads with the default pages
- New page creation works
- Saving edited content works
- Publish and edit routing works
- Duplicate and delete flows work

Optional:

- Run `npm run test:smoke:headed` to watch the browser
- Run `npm run test:smoke:ui` for Playwright's UI runner

## Visual review loop

Use the visual suite when changing layout, spacing, icons, or styling and you want rendered screenshots instead of only pass/fail behavior checks.

1. In one terminal, run `npm run serve:test`
2. The first time, create baselines with `npm run test:visual:update`
3. After UI changes, run `npm run test:visual`
4. If the new UI is intentional, refresh the baselines with `npm run test:visual:update`

What it captures:

- Main edit workspace
- Published page view
- Collapsed sidebar state

Useful commands:

- `npm run test:review` to open the visual test in a headed browser
- `npx playwright show-report` after a failed run to inspect diffs

## Confluence macro harness

Use this when you need to verify what `bar chart 2` actually renders inside Confluence instead of relying on the local preview.

1. Run `npm run test:confluence:login` once, complete login in the opened browser, then resume the paused run to save `tests/.auth/confluence.json`
2. Set `CONFLUENCE_EDIT_URL` to a page already containing the `bar chart 2` macro in edit mode
3. Run `npm run test:confluence:headed` to watch the run, or `npm run test:confluence` for a headless capture

Useful environment variables:

- `CONFLUENCE_EDIT_URL` or `CONFLUENCE_PAGE_URL`: target page to open
- `CONFLUENCE_MACRO_TITLE`: macro title to search for. Defaults to `bar chart 2`
- `CONFLUENCE_MACRO_SELECTOR`: override selector for the macro placeholder if title matching is not enough
- `CONFLUENCE_MACRO_EDIT_SELECTOR`: override selector for the macro toolbar edit button
- `CONFLUENCE_CONFIG_IFRAME_SELECTOR`: override selector for the Forge config iframe
- `CONFLUENCE_STORAGE_STATE`: alternate Playwright storage state path

Artifacts are written to Playwright's Confluence output folder under `%TEMP%\\dashboard-confluence-test-results` and include:

- Full editor screenshot
- Config iframe screenshot
- Preview column screenshot
- `confluence-diagnostics.json` with iframe metadata, preview sizes, and SVG presence

## Confluence attach mode

Use this when Google sign-in blocks the Playwright browser. It connects to your real Chrome session instead of trying to automate login.

1. Close existing Chrome windows that use the same profile
2. Start Chrome with remote debugging enabled
3. Sign into Confluence normally in that Chrome window
4. Run the attach harness

Windows example:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

Then run:

```powershell
$env:CONFLUENCE_EDIT_URL="https://reliantdash.atlassian.net/wiki/.../edit-v2/1507329"
npm run test:confluence:attach
```

Optional variables:

- `CONFLUENCE_CDP_URL`: defaults to `http://127.0.0.1:9222`
- `CONFLUENCE_MACRO_TITLE`: defaults to `bar chart 2`
- `CONFLUENCE_MACRO_SELECTOR`, `CONFLUENCE_MACRO_EDIT_SELECTOR`, `CONFLUENCE_CONFIG_IFRAME_SELECTOR`: override selectors when needed

Artifacts are written to `%TEMP%\\dashboard-confluence-attach`.

## Firebase setup

1. Create a Firebase project and add a Web app
2. Enable `Authentication` with the `Google` provider
3. Enable `Cloud Firestore`
4. Copy your Firebase web config into `firebase-config.js` and set `enabled: true`
5. Deploy Firestore rules from `firestore.rules`
6. Deploy Hosting using `firebase.json`

Official docs used for this setup:

- Firebase web app setup: https://firebase.google.com/docs/web/setup
- Google sign-in for web apps: https://firebase.google.com/docs/auth/web/google-signin
- Firestore web usage: https://firebase.google.com/docs/firestore/quickstart
- Firebase Hosting setup: https://firebase.google.com/docs/hosting

## Current capabilities

- Create, duplicate, edit, and delete pages
- Search page titles, tags, summaries, and body text
- Render markdown-style preview
- Local fallback when Firebase is not configured
- Shared cloud-backed pages when Firebase is configured and the user is signed in

## Next steps

- Add page-level permissions and role-based editing
- Add attachments and richer formatting
- Add dashboards backed by Jira, GitHub, PagerDuty, and CI data
- Add a left-nav hierarchy for spaces, folders, and page trees
