Dependency Scanning

What’s integrated

- GitHub Actions workflow `dependency-scan.yml` runs on PRs, main/develop, and weekly schedule:
  - npm audit (production deps, fail on HIGH+ severity)
  - OSV-Scanner (recursively scans repo manifests, fail on HIGH+)
- Dependabot updates for npm deps (daily) and GitHub Actions (weekly).

Files

- .github/workflows/dependency-scan.yml
- .github/dependabot.yml

Local usage

- Quick checks:
  - `npm run audit` (all deps)
  - `npm run audit:prod` (production deps only)
  - `npm run audit:fix` (attempt automatic fixes)

Tuning thresholds

- To tighten/relax failure levels, adjust:
  - npm audit step: `--audit-level=moderate|high|critical`
  - OSV-Scanner: `fail-on-severity: MODERATE|HIGH|CRITICAL`

Remediation workflow

1. Review CI failure logs for affected packages and paths.
2. If a safe update exists, let Dependabot open PRs or update manually.
3. If no patch is available:
   - Evaluate temporary pinning to a safe version.
   - Consider patch packages or vendor fixes.
   - Document risk acceptance with expiry date.
