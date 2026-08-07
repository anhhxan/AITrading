import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}

/**
 * Singleton Supabase Client instance for the Trading Platform.
 * Used for authenticating users, reading Robot configuration, and writing Trade History/Logs.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
