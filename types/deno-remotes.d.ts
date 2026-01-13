// Ambient module declarations for Deno remote imports used in Supabase Edge Functions.
// These are intentionally light so tsc tooling can resolve the specifiers without
// affecting runtime behaviour (Deno will fetch the real modules).

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export interface ConnInfo {
    remoteAddr: { hostname: string; port: number };
  }

  export function serve(
    handler: (req: Request, info: ConnInfo) => Response | Promise<Response>,
    options?: { port?: number; hostname?: string },
  ): Promise<void>;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  // Re-export everything from local package for TypeScript type resolution
  // At runtime, Deno will fetch from the remote URL
  // This declaration allows TypeScript to resolve types from the local @supabase/supabase-js package
  // while at runtime Deno fetches from the esm.sh URL above
  export * from '@supabase/supabase-js';
}

declare module 'https://esm.sh/v135/@supabase/supabase-js@2.45.4?dts' {
  export * from '@supabase/supabase-js';
}

declare module 'https://deno.land/x/zod@v3.22.4/mod.ts' {
  export * from 'zod';
}
