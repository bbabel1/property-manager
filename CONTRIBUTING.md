# Contributing to Property Manager

Thanks for considering a contribution! This guide explains how to set up your environment, our coding standards, and
the PR process.

## Quick Start

- Prereqs: Node 18+, npm 10+, Git, optional: Supabase CLI
- Install: `npm ci`
- Dev: `npm run dev`
- Tests: `npm run test`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`

## Project Conventions

- Stack: Next.js (App Router) + TypeScript, Tailwind, Supabase
- Code style: ESLint + Prettier (Tailwind plugin). Run lint before pushing.
- Types: Prefer explicit types; avoid `any`. Enable strictness in new code.
- Naming: Descriptive variables and functions; avoid single-letter names.
- State: Use local state or `zustand` for global app state. Avoid prop drilling.
- Forms: Use React Hook Form + Zod schemas; validate inputs in UI and API.
- APIs: For server routes, validate inputs, handle errors, and return typed JSON.
- Logging: Use `src/lib/logging.ts` request logger in API routes.
- Observability: Sentry for errors; OpenTelemetry spans if OTLP is configured.
- Security: No secrets in code or repo. Follow `docs/security/secrets-management.md`.

## Branching & Commits

- Branches: `feature/<short-name>`, `fix/<short-name>`, `chore/<short-name>`
- Commits: Keep messages concise and imperative. Group related changes.
- PR size: Prefer small, reviewable PRs. Large changes should be split.

## Pull Requests

1. Ensure CI passes locally (lint → typecheck → test → build)
2. Add/adjust tests when fixing/adding functionality
3. Update docs when behavior/config changes
4. If DB changes:
   - Add SQL migration in `supabase/migrations/`
   - Update `docs/database` or relevant guides
5. Open PR against `main` with a clear description and screenshots (if UI)
6. Wait for CI to pass and request review

## Testing

- Playwright tests: `npm run test` (install browsers if needed: `npx playwright install --with-deps`)
- Add focused tests for new logic; keep fast and deterministic

## Migrations & Edge Functions

- Migrations: Add ordered SQL files under `supabase/migrations/`
- Edge Functions: One function per folder under `supabase/functions/*`
- Pipelines: See `.github/workflows/*` and `docs/runbooks/migrations-pipeline.md`

## Issue Triage

- Use GitHub issue templates (bug/feature). Provide logs, repro steps, and environment details.

## Code of Conduct

- Be respectful and constructive. Assume positive intent. Focus on solutions.

## Getting Help

- Open a discussion or issue with the context, repro steps, and expected outcomes.
