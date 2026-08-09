import { createClient } from '@supabase/supabase-js';

// Khởi tạo Supabase Server-side client để bypass RLS (Service Role Key)
// Tuyệt đối không dùng file này ở Client Component (trình duyệt)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
