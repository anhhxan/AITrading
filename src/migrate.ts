import { getSupabaseAdmin } from './lib/supabase';

async function run() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc('exec_sql', {
    query: `
      ALTER TABLE public.active_positions
      ADD COLUMN IF NOT EXISTS context_snapshot JSONB DEFAULT '{}'::jsonb;
    `
  });
  
  if (error) {
    console.log("Failed via rpc, trying raw SQL...");
    // If rpc fails, it means we don't have an exec_sql function.
    console.log("Please run this SQL manually:");
    console.log("ALTER TABLE public.active_positions ADD COLUMN IF NOT EXISTS context_snapshot JSONB DEFAULT '{}'::jsonb;");
  } else {
    console.log("Success");
  }
}

run();
