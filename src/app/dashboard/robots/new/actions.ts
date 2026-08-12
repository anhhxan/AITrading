'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createRobot(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const name = formData.get('name') as string
  const slug = formData.get('slug') as string
  const accountId = formData.get('accountId') as string
  
  // Minimal config defaults for Phase 1
  const indicatorProfile = {
    length: parseInt(formData.get('indicatorLength') as string || '20'),
    source: formData.get('indicatorSource') as string || 'close',
    mult: parseFloat(formData.get('indicatorMult') as string || '2.0'),
    mult2: parseFloat(formData.get('indicatorMult2') as string || '1.0'),
  }

  const strategyProfile = { type: 'REVERSAL' }
  const riskProfile = { 
    max_position_size: parseFloat(formData.get('maxPositionSize') as string || '100'),
    stop_loss_pct: parseFloat(formData.get('stopLossPct') as string || '2.0')
  }
  const entryProfile = { mode: 'MARKET' }
  const exitProfile = { tp_mode: 'FIXED' }

  if (!name || !slug) {
    return { error: 'Name and slug are required' }
  }

  try {
    // 1. Create the Robot
    const { data: robot, error: robotError } = await supabase
      .from('robots')
      .insert({
        name,
        slug,
        user_id: user.id,
        current_state: 'IDLE',
        status: 'CREATED',
        trading_account_id: accountId || null
      })
      .select('id')
      .single()

    if (robotError) throw robotError

    // 2. Create the initial Config (Status defaults to PENDING per schema)
    const { error: configError } = await supabase
      .from('robot_configs')
      .insert({
        robot_id: robot.id,
        version: 1,
        status: 'PENDING',
        indicator_profile: indicatorProfile,
        strategy_profile: strategyProfile,
        risk_profile: riskProfile,
        entry_profile: entryProfile,
        exit_profile: exitProfile,
        created_by: user.id
      })

    if (configError) {
      // In a real production environment, we might want to clean up the robot if config fails,
      // but RLS and cascade might handle this, or we just throw.
      throw configError
    }

    // Success! Redirect to the detail page.
    // We cannot redirect inside try-catch easily without throwing NEXT_REDIRECT, so we just return success and redirect client-side, 
    // or we redirect after the try-catch block.
  } catch (err: any) {
    console.error('Create robot error:', err)
    return { error: err.message || 'Failed to create robot' }
  }

  // Redirect after success
  redirect('/dashboard/robots')
}
