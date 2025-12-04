# Tests

Playwright and Vitest hooks are stubbed in `package.json` today. When re-enabling tests, follow these conventions:

- **Playwright (e2e)**: place specs under `tests/e2e`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and app URL envs before running `npx playwright test`.
- **Vitest/unit**: place specs under `tests/unit` and use TS path aliases (`@/`). Run with `npx vitest` once dependencies are added.
- **Lint/type gates**: use `npm run lint` and `npm run typecheck` for fast safety checks.
- **Env-dependent tests**: prefer test-specific env files (e.g., `tests/.env.local`) instead of reusing production creds.

If you add a new test runner, update this file and `package.json` scripts accordingly.
