import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// null until a Supabase project is actually configured (see .env.example) —
// callers must check for this before use. Keeps "Continue with Google"
// cleanly absent rather than broken when it isn't set up yet.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
