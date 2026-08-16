import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Sync, zero-bundle-cost check — safe to call at render time to decide whether to show "Continue with Google" at all. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * The actual @supabase/supabase-js SDK is only ever needed once someone
 * clicks "Continue with Google" (or lands on the OAuth callback) — dynamic
 * import keeps it out of the login page's initial bundle otherwise, since
 * every visitor pays for it whether or not they ever use Google sign-in.
 */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(url as string, anonKey as string));
  }
  return clientPromise;
}
