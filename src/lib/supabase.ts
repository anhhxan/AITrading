import { createClient } from '@supabase/supabase-js';

export const getSupabaseAdmin = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Missing Supabase credentials!");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url === 'https://placeholder.supabase.co') {
    return {
      from: () => ({
        insert: async () => ({ error: { message: 'Mock Error', code: 'MOCK' } }),
        update: () => ({ eq: async () => ({ error: { message: 'Mock Error', code: 'MOCK' } }) }),
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: { message: 'Mock Error', code: 'MOCK' } })
          })
        })
      })
    } as any;
  }
  return createClient(
    url,
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
  );
};
