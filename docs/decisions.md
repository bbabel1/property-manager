# Decisions (ADRs - lightweight)

- **Supabase-only Auth**: NextAuth removed; Supabase Auth handles all auth flows (SSR helpers + middleware). Keeps server/client auth consistent with RLS.
- **Data Fetching**: Standardize on SWR for client-side fetching; avoid mixing patterns unless server actions fit better.
- **Forms**: React Hook Form + Zod for validation; shared resolver helpers preferred over bespoke handlers.
- **Styling**: Tailwind + Radix primitives + shadcn-inspired UI components in `src/components/ui`.
- **Telemetry**: Optional Sentry + OpenTelemetry; safe to disable via empty DSN. Keep instrumentation centralized in `instrumentation.ts` and `src/lib/metrics`.
