# AGENTS.md — Aplikasi Mitra Wahyu Beef

## Project Identity

- App: Aplikasi Mitra Wahyu Beef
- Repo path: `/home/node/.openclaw/workspace/mitra-wahyu-beef-app`
- GitHub remote: `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`
- Purpose: Partner/reseller Mitra app for Wahyu Beef. Production domain: mitra.wahyubeef.id. Do not mix with Member app.

## Recommended Commands

Available npm scripts detected:

- `npm run dev`
- `npm run dev:api`
- `npm run build`
- `npm run build:server`
- `npm run build:all`
- `npm run start`
- `npm run preview`
- `npm run test`
- `npm run typecheck`

Prefer these validation commands when relevant and available:

- `npm test`
- `npm run typecheck`
- `npm run build`
- Project-specific deploy/migration scripts only after inspecting them and confirming target.

## Universal Rules for Agents

- Treat Master Zatama as final decision maker.
- Work only inside this repo unless task explicitly says otherwise.
- Do not commit secrets, API keys, private keys, `.env*`, Cloudflare tokens, database dumps, or customer/staff data.
- Before changing code: inspect current git status and relevant files.
- After changing code: run available checks from `package.json` (at minimum build/test/typecheck when present).
- Keep changes small and documented. Do not rewrite unrelated modules.
- If deploying or restarting production services: ask confirmation first unless Master Zatama explicitly ordered deploy/restart.
- If pushing to GitHub: verify branch, remote, and clean working tree first.
- Preserve existing UI/UX style, Indonesian copy, business rules, and saved version labels unless asked to change.
- Update version docs or README when creating a named release/snapshot.

## GitHub / Deployment Notes

- Use existing `origin` remote. Do not replace remote without approval.
- If SSH deploy key fails, stop and report exact blocker; do not print private key contents.
- Cloudflare/production deploy commands may exist in scripts; inspect scripts before use.
- Never cross-deploy one app bundle into another Cloudflare Pages project.

## Handoff Format

When ending work, report:
1. Files changed
2. Commands/checks run
3. Git commit/tag/push status
4. Deploy/production status if touched
5. Known blockers or next steps

