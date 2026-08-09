import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { TradingAccountResponseSchema } from '@/core/contracts/TradingViewConfig';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('trading_accounts')
      .select('id, name, provider, is_active, api_key, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/accounts] DB Error:', error);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    // Process and mask data according to Contract (mask API key, explicitly exclude secret)
    const processedAccounts = data.map((account: any) => {
      let maskedKey = 'Unconfigured';
      if (account.api_key && account.api_key.length > 8) {
          maskedKey = account.api_key.substring(0, 4) + '...' + account.api_key.substring(account.api_key.length - 4);
      }
      
      const responseObj = {
          id: account.id,
          name: account.name,
          provider: account.provider,
          status: account.is_active ? 'ACTIVE' : 'INACTIVE',
          maskedApiKey: maskedKey,
          lastConnected: account.created_at
      };
      
      // Enforce the schema which strips api_secret
      return TradingAccountResponseSchema.parse(responseObj);
    });

    return NextResponse.json(processedAccounts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
