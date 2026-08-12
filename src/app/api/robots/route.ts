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
    const { name, slug, accountId, indicatorProfile, strategyProfile, riskProfile, entryProfile, exitProfile } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    // 1. Create the Robot using the authenticated user.id
    const { data: robot, error: robotError } = await supabase
      .from('robots')
      .insert({
        name,
        slug,
        user_id: user.id, // Strictly server-side authenticated user ID
        current_state: 'IDLE',
        status: 'CREATED',
        trading_account_id: accountId || null
      })
      .select('*')
      .single()

    if (robotError) {
      console.error('Error inserting robot:', robotError)
      return NextResponse.json({ error: robotError.message }, { status: 500 })
    }

    // 2. Create the initial Config (Status defaults to PENDING per schema)
    const { error: configError } = await supabase
      .from('robot_configs')
      .insert({
        robot_id: robot.id,
        version: 1,
        status: 'PENDING',
        indicator_profile: indicatorProfile || { length: 20, source: 'close', mult: 2.0, mult2: 1.0 },
        strategy_profile: strategyProfile || { type: 'REVERSAL' },
        risk_profile: riskProfile || { max_position_size: 100, stop_loss_pct: 2.0 },
        entry_profile: entryProfile || { mode: 'MARKET' },
        exit_profile: exitProfile || { tp_mode: 'FIXED' },
        created_by: user.id // Also strictly set by server
      })

    if (configError) {
      console.error('Error inserting config:', configError)
      return NextResponse.json({ error: configError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, robot }, { status: 201 })
  } catch (err: any) {
    console.error('API /robots error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
