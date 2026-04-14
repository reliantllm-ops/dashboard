# Engineering Workspace

An editable engineering workspace with wiki-style pages, Firebase-ready cloud sync, and Google sign-in support.

## Open locally

Open `index.html` directly in a browser.

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
