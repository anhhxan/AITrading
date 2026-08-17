import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { decryptCredential } from '@/lib/encryption';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = params.id;
    const supabase = getSupabaseAdmin();
    const { data: account, error } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error || !account) {
      return NextResponse.json({ status: 'FAILED', message: 'Account not found' }, { status: 404 });
    }

    // Gate 0 strict requirements
    if (account.provider !== 'Binance' && account.provider !== 'BINANCE') {
      return NextResponse.json({ status: 'NOT_CONFIGURED', message: 'Provider not supported for test connection' });
    }

    if (!account.is_active) {
      return NextResponse.json({ status: 'FAILED', message: 'Account is inactive' });
    }

    if (account.env !== 'TESTNET') {
      return NextResponse.json({ status: 'REJECTED', message: 'Only TESTNET accounts are allowed for testing in Gate 0' }, { status: 403 });
    }

    if (account.type !== 'FUTURES') {
      return NextResponse.json({ status: 'REJECTED', message: 'Only FUTURES accounts are supported' }, { status: 403 });
    }

    if (!account.api_key || !account.api_secret) {
      return NextResponse.json({ status: 'FAILED', message: 'Missing credentials' });
    }

    let apiKey = account.api_key;
    let apiSecret = '';
    try {
      apiSecret = decryptCredential(account.api_secret);
    } catch (err) {
      return NextResponse.json({ status: 'FAILED', message: 'Failed to decrypt credentials' });
    }

    // Direct Binance Futures Testnet HTTP API
    const baseUrl = 'https://testnet.binancefuture.com';
    const endpoint = '/fapi/v2/account';
    const timestamp = Date.now().toString();
    const queryString = `timestamp=${timestamp}`;
    
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');

    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.totalWalletBalance !== 'undefined') {
        return NextResponse.json({ status: 'CONNECTED', message: 'Connection successful' });
      }
    }

    const errData = await res.json().catch(() => ({}));
    return NextResponse.json({ status: 'FAILED', message: 'Invalid credentials or API error', details: errData });
    
  } catch (error) {
    return NextResponse.json({ status: 'FAILED', message: 'Internal server error' }, { status: 500 });
  }
}
