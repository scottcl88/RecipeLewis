# RecipeLewis

Private family cookbook (v2): Vite + React + TypeScript SPA on Firebase Hosting, Firestore, Auth and Storage (project `recipe-lewis-app`). Succeeds RecipeLewis-Web (Blazor) and RecipeLewis-API. No custom API: security rules are the server.

Developed by Scott Lewis. All rights reserved (see LICENSE).

## Features
Sign-in only (no self-registration) · browse/search/filter (URL-shareable) · recipe view with print stylesheet and cooking mode · add/edit with structured ingredients, steps, photos (resized client-side), local draft autosave · admin member management · light/dark themes · WCAG 2.2 AA oriented.

## Roles
Custom claims: `admin: true` (Scott) or `member: true` (invited family). Members can create, edit and delete any recipe. Signed-in users without a claim see an "Awaiting approval" screen and cannot read data.

## Develop
```bash
npm ci
cp .env.example .env.local        # fill in web config (public ids; kept out of git)
npm run dev
npm run typecheck && npm run lint && npm test && npm run build
npm run test:rules                # needs Java 11+ (Firestore emulator)
```
Emulators: `npm run emulators`, then run the app with `VITE_USE_EMULATOR=1`. `scripts/dev-user.mjs` creates emulator-only test users.

## Admin: invite / remove (no Cloud Function)
`scripts/admin.mjs` uses Admin SDK with Application Default Credentials:
```bash
node scripts/admin.mjs invite someone@example.com [--admin] [--name "Name"]   # grants claim, prints a single-use set-password link
node scripts/admin.mjs remove someone@example.com
node scripts/admin.mjs list
```
The Admin page lists members and records invites (`invites/{email}`); it shows the command to run. A callable Cloud Function could replace the script later; the project is already on the Blaze plan, but nothing here requires one.

## Migration from the legacy SQL export
`scripts/migrate.mjs` reads the **private** export directory (never commit or upload it). Emulator first:
```bash
firebase emulators:exec --only auth,firestore,storage --project demo-recipelewis "node scripts/migrate.mjs --emulator --with-users"
```
Skips soft-deleted recipes/documents. Migrates names/emails only (no hashes/tokens). Production requires `--production` plus `CONFIRM_PRODUCTION_MIGRATION=yes` and the owner's approval.

## Deploy
Rules and hosting are deployed with the Firebase CLI. Rules are **not** deployed by CI here; deploy only with the owner's approval: `firebase deploy --only firestore:rules,storage`. Preview: `firebase hosting:channel:deploy <name>`.

## Notes
- Data model deviations from the draft: reads need a member/admin claim (not just sign-in); new recipes store structured `ingredients`/`steps` while migrated ones keep sanitized legacy HTML; no composite indexes (≈57 recipes are filtered client-side); users/{uid} is created by the admin script, not the client.
- No App Check yet (recommended after launch).

## AI-assisted development
This project was developed with AI assistance. AI-generated content is reviewed by the maintainer but may contain errors. See SECURITY.md to report issues.
