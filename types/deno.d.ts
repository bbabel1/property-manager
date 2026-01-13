// Minimal Deno ambient type for TypeScript tooling (VSCode, tsc).
// Supabase Edge Functions run in the Deno runtime, which provides this global.
// This file is NOT used by Deno itself; it only satisfies type checking.

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

