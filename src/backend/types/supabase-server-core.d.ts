// @supabase/server/core ships exports-map-only (no "main"/"types" root
// fallback) — this project's tsconfig (moduleResolution: "node", shared by
// every backend file, none of which need changing just for this one
// integration point) can't statically resolve subpath exports. This ambient
// declaration types the one function this app actually calls
// (auth.routes.ts's Supabase OAuth verification) without requiring a
// project-wide moduleResolution change — switching to "node16" broke
// unrelated ESM-only deps like uuid when tried. Shape matches
// node_modules/@supabase/server/docs/core-primitives.md.
declare module '@supabase/server/core' {
  export interface SupabaseUserClaims {
    id: string;
    email?: string;
    role?: string;
    [key: string]: unknown;
  }

  export interface SupabaseAuthResult {
    authMode: string;
    token: string;
    userClaims?: SupabaseUserClaims;
    jwtClaims?: Record<string, unknown>;
    keyName?: string;
  }

  export interface SupabaseAuthError {
    message: string;
    status: number;
    code?: string;
  }

  export function verifyCredentials(
    credentials: { token: string | null; apikey: string | null },
    opts: { auth: string | string[] }
  ): Promise<{ data: SupabaseAuthResult | null; error: SupabaseAuthError | null }>;
}
