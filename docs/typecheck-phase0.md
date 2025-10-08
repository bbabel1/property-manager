# Phase 0 – Baseline & Triage

## Command run
- `npm run typecheck -- --pretty false`
- Raw output captured in [`scripts/typecheck-report.md`](../scripts/typecheck-report.md).

## TypeScript error inventory
| Module tag | Files (examples) | Count | Notes |
| --- | --- | --- | --- |
| Routes (`src/app/**`) | `src/app/api/...`, `src/app/(protected)/...` | 99 | Widespread `supabase`/`supabaseAdmin` optionality checks missing, unsafe casts from `unknown`, and incorrect enum/parameter usage across API handlers and pages. |
| Libraries (`src/lib/**`, schemas, types) | `src/lib/unit-service.ts`, `src/lib/property-service.ts`, `src/schemas/buildium.ts` | 43 | Strong typing gaps in service layers (e.g., untyped generic calls, missing entity types, strict schema enums). No errors surfaced in `src/lib/buildium-mappers.ts`. |
| Components (`src/components/**`) | `src/components/AddUnitModal.tsx`, `src/components/ui/calendar.tsx` | 6 | Zod error handling and component prop typing gaps. |
| Storybook (`stories/**`) | `stories/InlineEditCard.stories.tsx` | 1 | Missing `@storybook/react` types. |

### High-priority error themes
- **Supabase client nullability:** 54 errors (`TS18048`/`TS2304`) across API routes rely on `supabase`/`supabaseAdmin` globals without runtime guards, leaving uncertainty about initialization timing and required product flows.
- **Unknown-to-undefined arguments:** 19 errors (`TS2345`) stem from forwarding caught exceptions or unknown payloads directly into helpers expecting `undefined`, indicating missing validation on Buildium webhook responses.
- **Missing domain models:** 6 errors cite `BuildiumPropertyImage` not being declared, blocking property media sync unless product clarifies expected shape or we generate types from Buildium docs.
- **Data shape mismatches:** 5 owner routes expect `primary_address_line_2`; 3 contact/unit schemas reject free-form country strings, implying product must confirm whether Buildium-only values are allowed or if we need fallback handling.
- **Zod schema regressions:** Zod `required_error` options were removed in v3, requiring validation copy updates before onboarding flows can work.

## `any` / `@ts-ignore` catalogue
- `@ts-ignore`: 1 occurrence in [`src/components/units/LeaseSection.tsx:277`](../src/components/units/LeaseSection.tsx). Documented as a Supabase `foreignTable` typing gap.
- Explicit `any` usage: 1,075 hits tracked in [`scripts/any-usages.txt`](../scripts/any-usages.txt) with per-file counts in [`scripts/any-usage-counts.txt`](../scripts/any-usage-counts.txt). Top owners:
  1. `supabase/functions/buildium-sync/index.ts` – 144
  2. `src/lib/buildium-mappers.ts` – 131
  3. `src/lib/buildium-edge-client.ts` – 56
  4. `src/app/api/properties/route.ts` – 32
  5. `src/lib/relationship-resolver.ts` – 24

## Blockers needing product decisions
1. **Country enumeration strategy:** Strict `Country` unions in [`src/types/contacts.ts`](../src/types/contacts.ts) and [`src/types/units.ts`](../src/types/units.ts) reject arbitrary strings coming from Buildium. Product must decide whether to relax validation or enforce canonical lists before integrations continue.
2. **Property address fields:** Buildium owner sync expects `primary_address_line_2`, but our local owner model omits it (`src/app/api/owners/[id]/route.ts`). Confirm whether this field should be stored/displayed.
3. **Property image payloads:** APIs assume a `BuildiumPropertyImage` type that does not exist. We need product/Integrations input on desired schema (metadata, storage strategy) before implementing.
4. **Admin invite flow:** The Supabase Admin SDK lacks `getUserByEmail`. Determine whether product is comfortable switching flows (e.g., fetch by ID via RPC) or if we need to request Supabase feature support.

## Next steps
- Align with product on blockers above.
- Introduce guards/factories for Supabase clients to unblock API route checks.
- Backfill missing Buildium domain types (images, owner address) once product direction is confirmed.
- Replace top `any` clusters with generated SDK types to shrink future triage scope.

## Phase 1 snapshot (2025-09-23)
- `npm run typecheck -- --pretty false` captured in [`scripts/typecheck-report.md`](../scripts/typecheck-report.md) for reproducibility.
- Supabase client guard lives at `src/lib/supabase-client.ts`; only `src/app/api/staff/route.ts` is refactored so far, the remaining 50+ optionality errors highlight where the guard still needs to be applied.
- `src/lib/buildium-mappers.ts` now uses concrete Buildium domain models via `src/lib/types/buildium.ts`. Removing the 130+ `any` usages surfaced ~35 real type gaps (countries defaulting to enums, GL account payload shape, sync-status conversions) that will need follow-up fixes.
- Buildium property image API routes still assume missing tables/types; typecheck now fails fast with `property_images` table lookups and missing `BuildiumPropertyImage` imports, confirming the need for product direction before wiring those endpoints.
- Storybook and Storybook-adjacent deps remain untyped (`@storybook/react` missing), unchanged from the original inventory.

### Updated focus list
- **Supabase guard adoption:** propagate `requireSupabaseAdmin` / `getServerSupabaseClient` through `src/app/api/bank-accounts`, `owners`, Buildium sync routes.
- **Buildium mapper follow-up:** normalize enum fallbacks (countries, GL account types), decide on JSON column typing for `check_printing_info` and similar payloads, and reconcile GL sub-account mapping with the generated `Database` types.
- **Property image/contracts:** align schema/table availability with API routes or stub adapters until `property_images` tables exist.
- **Property image/contracts:** `src/app/api/buildium/properties/[id]/images/route.ts` currently returns 501 until schema is finalized; unblock by either introducing a typed `property_images` table or confirming that Buildium URLs are the long-term source of truth.

## Phase 1 product alignment status
| Topic | Decision owner | Current status | Interim assumption |
| --- | --- | --- | --- |
| Country enumeration strategy | Product/Integrations | Pending confirmation | Accept Buildium-provided `string` values in our types while retaining canonical list for validation warnings. Need explicit call on whether to relax enums in `contacts`/`units` DB schema or maintain strict enums with reconciliation jobs. |
| Owner address line 2 | Product | Pending confirmation | Extend owner model to include optional `primary_address_line_2` to keep payload parity. Confirm UI/UX placement + whether it syncs bi-directionally. |
| Property image payloads | Product/Integrations | Pending confirmation | Model image metadata based on Buildium docs (id, url, caption, sort order) and mark TODO to revisit once product signs off. Clarify storage (Supabase storage vs Buildium URL passthrough) and whether `property_images` table should be created in Phase 2. |
| Supabase admin invite flow | Product/Engineering | Pending confirmation | Use existing Admin SDK methods plus fallback RPC lookup; document TODO if product prefers alternate flow. Need alignment on acceptable fallback (manual invite email vs. RPC) before removing `getUserByEmail` shim. |
