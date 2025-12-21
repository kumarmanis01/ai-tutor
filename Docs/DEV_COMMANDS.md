# Developer Commands — Evaluator & Integration

Useful commands I run for local testing and CI emulation.

Start temporary Postgres (local):

```powershell
docker run -d -p 5433:5432 --name ai_tutor_test_pg -e POSTGRES_PASSWORD=pass -e POSTGRES_USER=test -e POSTGRES_DB=ai_tutor_test postgres:15
```

Apply Prisma migrations:

```powershell
$env:DATABASE_URL='postgres://test:pass@127.0.0.1:5433/ai_tutor_test'
npx prisma migrate deploy --preview-feature
npx prisma generate
```

Bundle evaluator (esbuild):

```bash
npx esbuild scripts/runAlertEvaluator.ts --bundle --platform=node --target=node20 --outfile=build/runAlertEvaluator.js --external:@prisma/client --external:prom-client --external:ioredis --sourcemap
```

Run bundled evaluator (dry-run single run):

```powershell
$env:DATABASE_URL='postgres://test:pass@127.0.0.1:5433/ai_tutor_test'
$env:RUN_ONCE='1'; $env:EVALUATOR_DRY_RUN='1'
node build/runAlertEvaluator.js
```

Local cleanup:

```powershell
docker rm -f ai_tutor_test_pg
```

Tips:
- Use the `deployment/` snippets for quick systemd/Procfile/Helm deploy examples.
- Add repo secrets (`DATABASE_URL`, `PUSHGATEWAY_URL`) for CI/staging to run full end-to-end tests.
 
Cross-platform Git commits
-------------------------

On Windows PowerShell the POSIX no-op `true` (or `; true`) is not available — this is why you may have seen the PowerShell error "true : The term 'true' is not recognized" when running commit commands copied from POSIX shells. Use one of the following:

- Use Git Bash or WSL (POSIX shell) when running shell snippets that include `; true`.
- Prefer the cross-platform Node wrapper included in the repo:

```powershell
node scripts/git-commit-wrapper.js --dry -m "your commit message"
# remove --dry to actually commit
node scripts/git-commit-wrapper.js -m "your commit message"
```

This wrapper avoids shell-specific suffixes and works on Windows, macOS and Linux.
