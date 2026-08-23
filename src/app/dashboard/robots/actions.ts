'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function swapRobotOrderAction(robotId1: string, order1: number, robotId2: string, order2: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Update robot 1
  const { error: e1 } = await supabase
    .from('robots')
    .update({ display_order: order2 })
    .eq('id', robotId1)
    .eq('user_id', user.id)

  if (e1) return { error: e1.message }

  // Update robot 2
  const { error: e2 } = await supabase
    .from('robots')
    .update({ display_order: order1 })
    .eq('id', robotId2)
    .eq('user_id', user.id)

  if (e2) return { error: e2.message }

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
