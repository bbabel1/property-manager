# Lint & TypeScript Skip Directives Audit

This document catalogs all files containing directives that skip TypeScript checking or ESLint rules.

**Generated:** 2025-12-23

## Summary

- **@ts-nocheck**: 1 file (disables all TypeScript checking for the file)
- **eslint-disable (file-level)**: 0 files
- **eslint-disable-line/next-line**: 2 occurrences in 2 files
- **@ts-ignore**: 0 files
- **@ts-expect-error**: 0 files

---

## TypeScript Skip Directives

### Files with `@ts-nocheck`

1. **supabase/functions/buildium-sync/index.ts**
   - Line 2: `// @ts-nocheck`
   - Reason: Supabase Edge Function (Deno runtime)

---

## ESLint Skip Directives

### File-level `eslint-disable`

- None detected.

### Line-level `eslint-disable(-next-line|-line)`

1. **src/components/monthly-logs/MonthlyStatementTemplate.tsx**
   - Line 131: `// eslint-disable-next-line @next/next/no-img-element -- tests use a plain img to avoid Next.js' image pipeline`

2. **src/components/monthly-logs/__tests__/MonthlyStatementTemplate.test.tsx**
   - Line 16: `// eslint-disable-next-line @next/next/no-img-element -- mock keeps tests decoupled from Next.js Image`

---

## Recommendations

- Review the remaining `@ts-nocheck` in the Supabase Edge Function to see if Deno types can be enabled instead of skipping checks entirely.
- The two Next.js image suppressions are intentional test shims; no action needed unless tests switch to Next.js `Image`.

## Notes

- No `@ts-ignore` or `@ts-expect-error` directives were found.
