'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Note: Commands should be created in the `robot_commands` table.
// The Worker will pick them up.
export async function sendRobotCommand(robotId: string, commandType: 'START' | 'STOP') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const correlationId = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`

  // 1. Generate a valid UUID for the command (since `command_id` is UUID UNIQUE NOT NULL)
  const commandId = crypto.randomUUID();

  const { error } = await supabase
    .from('robot_commands')
    .insert({
      command_id: commandId,
      robot_id: robotId,
      user_id: user.id,
      command_type: commandType,
      correlation_id: correlationId,
      status: 'RECEIVED'
    })

  if (error) {
    console.error(`Send ${commandType} error:`, error)
    return { error: error.message }
  }

  revalidatePath(`/dashboard/robots/${robotId}`)
  return { success: true }
}

export async function archiveRobotAction(robotId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.rpc('archive_robot', {
    p_robot_id: robotId
  })

  if (error) {
    console.error('Archive robot error:', error)
    return { error: error.message }
  }

  if (data && data.success === false) {
    return { error: data.message }
  }

  revalidatePath(`/dashboard/robots`)
  revalidatePath(`/dashboard/robots/${robotId}`)
  return { success: true }
}

export async function applyRobotConfigAction(robotId: string, configId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.rpc('apply_robot_config', {
    p_robot_id: robotId,
    p_config_id: configId
  })

  if (error) {
    console.error('Apply config error:', error)
    return { error: error.message }
  }

  if (data && data.success === false) {
    return { error: data.message }
  }

  revalidatePath(`/dashboard/robots/${robotId}`)
  return { success: true }
}

export async function toggleTradingAction(robotId: string, enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const updateData: any = { trading_enabled: enabled }

  if (enabled) {
    const { data: robot } = await supabase.from('robots').select('status').eq('id', robotId).single()
    if (robot && robot.status === 'CREATED') {
      updateData.status = 'RUNNING'
    }

    const { data: positions } = await supabase.from('active_positions').select('id').eq('robot_id', robotId)
    if (!positions || positions.length === 0) {
      updateData.current_state = 'WAIT_SIGNAL'
    }
  }

  const { error } = await supabase
    .from('robots')
    .update(updateData)
    .eq('id', robotId)

  if (error) {
    console.error('Toggle trading error:', error)
    return { error: error.message }
  }

  revalidatePath(`/dashboard/robots`)
  revalidatePath(`/dashboard/robots/${robotId}`)
  return { success: true }
}
