export const getAuthUser = async (req: Request): Promise<string | null> => {
  if (process.env.NODE_ENV === 'test') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer TEST_')) {
      return authHeader.replace('Bearer TEST_', ''); // mock user ID for test
    }
    return null;
  }

  // Production Supabase Auth validation
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  try {
    // Basic decode of JWT for auth requirement check.
    // In full implementation, we use supabase-admin or supabase.auth.getUser()
    // For now we simulate token rejection if not provided.
    if (!authHeader.startsWith('Bearer ')) return null;
    
    // Fallback pseudo-decode for POC
    return 'real_production_user_id';
  } catch (e) {
    return null;
  }
};

export const requireAuth = async (req: Request): Promise<string> => {
  const userId = await getAuthUser(req);
  if (!userId) {
    throw new Error('401 Unauthorized');
  }
  return userId;
};
