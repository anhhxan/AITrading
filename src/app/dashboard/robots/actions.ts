'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateRobotOrdersAction(updates: { id: string, order: number }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Supabase doesn't easily support batch updates of different rows with different values in JS client without RPC.
  // So we will do it sequentially (usually max 10-20 robots so it's fast enough for UI).
  for (const update of updates) {
    const { error } = await supabase
      .from('robots')
      .update({ display_order: update.order })
      .eq('id', update.id)
      .eq('user_id', user.id)
    
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/robots')
  return { success: true }
}

export async function archiveRobotAction(robotId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify constraints
  const { data: robot, error: fetchErr } = await supabase
    .from('robots')
    .select('user_id, trading_mode, status, trading_enabled')
    .eq('id', robotId)
    .single()

  if (fetchErr || !robot) return { error: 'Robot not found' }
  if (robot.user_id !== user.id) return { error: 'Unauthorized' }
  if (robot.trading_mode !== 'PAPER') return { error: 'Only PAPER robots can be archived' }
  if (robot.status === 'RUNNING') return { error: 'Cannot archive a RUNNING robot' }
  if (robot.trading_enabled === true) return { error: 'Trading must be disabled before archiving' }

  const { error: archiveErr } = await supabase
    .from('robots')
    .update({ is_archived: true })
    .eq('id', robotId)
    .eq('user_id', user.id)

  if (archiveErr) {
    console.error('Archive robot error:', archiveErr)
    return { error: 'Lỗi khi Archive Robot.' }
  }

  revalidatePath('/dashboard/robots')
  return { success: true }
}
