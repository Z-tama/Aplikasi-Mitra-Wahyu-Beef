# Contributing

## Required collaboration flow

1. Sync latest `main` before work:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
```

2. Create a feature branch:

```bash
git checkout -b feature/short-description
```

3. Make focused changes only.
4. Run project checks before push. For Node/Vite/React projects:

```bash
npm test
npm run build
```

5. Push only the feature branch:

```bash
git push origin feature/short-description
```

6. Open a Pull Request or report the branch name to the coordinator.

## Forbidden

- Direct push to `main`
- Force push
- Deploying production without owner/coordinator approval
- Reverting project to an older stale-clone version
- Overwriting unrelated files

## Stale clone recovery

Use only when local changes are disposable:

```bash
git fetch origin
git checkout main
git reset --hard origin/main
git clean -fd
git checkout -b feature/short-description
```

Warning: this deletes local uncommitted work.
