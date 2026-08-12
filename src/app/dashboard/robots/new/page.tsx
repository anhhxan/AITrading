import { createClient } from '@/lib/supabase/server'
import { Bot, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import CreateRobotForm from './CreateRobotForm'

export default async function NewRobotPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch accounts to link
  const { data: accounts } = await supabase
    .from('trading_accounts')
    .select('id, name')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/robots" className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create New Robot</h1>
          <p className="text-sm text-slate-500 mt-1">Configure a new automated trading worker.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm">
        <CreateRobotForm accounts={accounts || []} />
      </div>
    </div>
  )
}
