import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Validate authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to create a robot.' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { 
      name, slug, accountId, timeframe, signalSource, 
      tradingViewSymbol, executionSymbol, provider,
      indicatorProfile, strategyProfile, riskProfile, 
      entryProfile, exitProfile, notificationProfile, 
      tradingSession, tradingMode 
    } = body

    // 1. Validation - Required Strings
    const requiredStrings: Record<string, any> = { 
      name, slug, timeframe, signalSource, 
      tradingViewSymbol, executionSymbol, provider 
    }
    for (const [key, value] of Object.entries(requiredStrings)) {
      if (typeof value !== 'string' || !value.trim()) {
        return NextResponse.json(
          { error: `Missing required field: ${key}` },
          { status: 400 }
        )
      }
    }

    // 2. Validation - Numeric Fields
    const validatePositiveNumber = (val: any, fieldName: string) => {
      if (val === undefined || val === null || val === '') return `Missing ${fieldName}`
      const num = Number(val)
      if (isNaN(num) || !isFinite(num) || num <= 0) {
        return `Invalid ${fieldName}`
      }
      return null
    }

    if (indicatorProfile && 'length' in indicatorProfile) {
      const err = validatePositiveNumber(indicatorProfile.length, 'indicatorLength')
      if (err) return NextResponse.json({ error: err }, { status: 400 })
    }
    if (riskProfile) {
      if ('max_position_size' in riskProfile) {
        const err = validatePositiveNumber(riskProfile.max_position_size, 'maxPositionSize')
        if (err) return NextResponse.json({ error: err }, { status: 400 })
      }
      if ('stop_loss_pct' in riskProfile) {
        const err = validatePositiveNumber(riskProfile.stop_loss_pct, 'stopLossPct')
        if (err) return NextResponse.json({ error: err }, { status: 400 })
      }
    }

    // 3. Validate Trading Account Ownership
    if (accountId) {
      const { data: account, error: accountError } = await supabase
        .from('trading_accounts')
        .select('id')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .single()
      
      if (accountError || !account) {
        return NextResponse.json(
          { error: 'Trading account not found or not owned by current user' },
          { status: 403 }
        )
      }
    }

    // Prepare defaults for missing profiles/fields based on current business logic
    const resolvedIndicatorProfile = indicatorProfile || { length: 20, source: 'close', mult: 2.0, mult2: 1.0 }
    const resolvedStrategyProfile = strategyProfile || { type: 'REVERSAL' }
    const resolvedRiskProfile = riskProfile || { max_position_size: 100, stop_loss_pct: 2.0 }
    const resolvedEntryProfile = entryProfile || { mode: 'MARKET' }
    const resolvedExitProfile = exitProfile || { tp_mode: 'FIXED' }
    const resolvedNotificationProfile = notificationProfile || {}

    // 4. Insert into `robots` table with all NOT NULL required fields
    const { data: robot, error: robotError } = await supabase
      .from('robots')
      .insert({
        name,
        slug,
        user_id: user.id,
        current_state: 'IDLE',
        status: 'CREATED',
        trading_account_id: accountId || null,
        timeframe,
        signal_source: signalSource,
        trading_view_symbol: tradingViewSymbol,
        execution_symbol: executionSymbol,
        provider,
        trading_mode: tradingMode || 'PAPER',
        trading_session: tradingSession || '24/7',
        trading_enabled: false,
        paper_balance: 10000,
        indicator_profile: resolvedIndicatorProfile,
        strategy_profile: resolvedStrategyProfile,
        risk_profile: resolvedRiskProfile,
        entry_profile: resolvedEntryProfile,
        exit_profile: resolvedExitProfile,
        notification_profile: resolvedNotificationProfile,
        worker_id: process.env.DEFAULT_WORKER_ID || 'local-pc-01'
      })
      .select('*')
      .single()

    if (robotError) {
      if (robotError.code === '23505') { // Unique violation for slug
        return NextResponse.json({ error: 'Robot slug already exists' }, { status: 409 })
      }
      console.error(`[CREATE ROBOT] Robots Insert Error for user ${user.id}:`, robotError.message) // Safe log
      return NextResponse.json({ error: 'Failed to create robot' }, { status: 500 })
    }

    // 5. Insert into `robot_configs`
    const { error: configError } = await supabase
      .from('robot_configs')
      .insert({
        robot_id: robot.id,
        version: 1,
        status: 'PENDING',
        indicator_profile: resolvedIndicatorProfile,
        strategy_profile: resolvedStrategyProfile,
        risk_profile: resolvedRiskProfile,
        entry_profile: resolvedEntryProfile,
        exit_profile: resolvedExitProfile,
        notification_profile: resolvedNotificationProfile,
        created_by: user.id
      })

    if (configError) {
      console.error(`[CREATE ROBOT] Config Insert Error for robot ${robot.id}:`, configError.message)
      
      // Cleanup: Atomicity fallback - Delete the robot if config fails
      const { error: cleanupError } = await supabase
        .from('robots')
        .delete()
        .eq('id', robot.id)
      
      if (cleanupError) {
        console.error(`[CREATE ROBOT] CRITICAL: Failed to cleanup robot ${robot.id} after config error.`, cleanupError.message)
      }
      
      return NextResponse.json({ error: 'Failed to create robot configuration' }, { status: 500 })
    }

    return NextResponse.json({ success: true, robot }, { status: 201 })
  } catch (err: any) {
    console.error('[CREATE ROBOT] Unhandled exception:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
