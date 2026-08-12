'use server'

import { createClient } from '@/lib/supabase/server'
import { encryptCredential } from '@/lib/encryption'
import { revalidatePath } from 'next/cache'

export async function addTradingAccount(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const name = formData.get('name') as string
  const provider = formData.get('provider') as string
  const apiKey = formData.get('apiKey') as string
  const apiSecret = formData.get('apiSecret') as string

  if (!name || !provider || !apiKey || !apiSecret) {
    return { error: 'Missing required fields' }
  }

  try {
    // Encrypt BOTH key and secret
    const encryptedKey = encryptCredential(apiKey)
    const encryptedSecret = encryptCredential(apiSecret)

    const { error } = await supabase.from('trading_accounts').insert({
      user_id: user.id,
      name,
      provider,
      api_key: encryptedKey,
      api_secret: encryptedSecret,
      is_active: true
    })

    if (error) throw error

    revalidatePath('/dashboard/trading-accounts')
    return { success: true }
  } catch (err: any) {
    console.error('Add account error:', err)
    return { error: err.message || 'Failed to add account' }
  }
}

export async function deleteTradingAccount(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // RLS will ensure user can only delete their own account
  const { error } = await supabase.from('trading_accounts').delete().eq('id', id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/dashboard/trading-accounts')
  return { success: true }
}
