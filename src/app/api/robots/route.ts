import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { ExpectedIndicatorConfigSchema } from '@/core/contracts/TradingViewConfig';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('robots')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/robots] DB Error:', error);
      return NextResponse.json({ error: 'Failed to fetch robots' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Minimal validation
    if (!body.name || !body.slug || !body.timeframe || !body.signal_source || !body.execution_symbol || !body.provider) {
       return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Force Canonical Mapping for TradingView if applicable
    let indicatorProfile = body.indicator_profile || {};
    if (body.signal_source === 'TradingView') {
        const configToValidate = {
            length: Number(indicatorProfile.length || 20),
            source: indicatorProfile.source || 'close',
            mult: Number(indicatorProfile.mult || 2.5),
            mult2: Number(indicatorProfile.mult2 || 1.3),
            // We omit mapping here because Zod will inject the default canonical mapping
        };
        const parsedConfig = ExpectedIndicatorConfigSchema.parse(configToValidate);
        indicatorProfile = parsedConfig; // Now contains the enforced immutable mapping
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('robots')
      .insert({
        name: body.name,
        slug: body.slug,
        timeframe: body.timeframe,
        signal_source: body.signal_source,
        trading_view_symbol: body.trading_view_symbol || body.execution_symbol,
        execution_symbol: body.execution_symbol,
        provider: body.provider,
        indicator_profile: indicatorProfile,
        strategy_profile: body.strategy_profile || {},
        risk_profile: body.risk_profile || {},
        status: 'CREATED',
        current_state: 'IDLE'
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/robots] DB Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
