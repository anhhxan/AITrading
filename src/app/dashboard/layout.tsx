import { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Bot, LayoutDashboard, Wallet, Activity, History, List, Settings, LogOut, PlaySquare, CreditCard } from 'lucide-react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Paper Trading', href: '/dashboard/paper-trading', icon: PlaySquare },
    { name: 'Robots', href: '/dashboard/robots', icon: Bot },
    { name: 'Trading Accounts', href: '/dashboard/trading-accounts', icon: CreditCard },
    { name: 'Trade History', href: '/dashboard/trades', icon: Activity },
    { name: 'Audit Logs', href: '/dashboard/audit', icon: History },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-slate-900 text-white flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <Bot className="w-6 h-6 mr-3 text-blue-400" />
          <span className="font-bold text-lg tracking-tight">AI Trading</span>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Icon className="w-5 h-5 mr-3 opacity-75" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <form action="/login/actions/logout" method="POST">
            <button className="flex w-full items-center px-3 py-2.5 text-sm font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <LogOut className="w-5 h-5 mr-3 opacity-75" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar (Mobile) */}
        <header className="md:hidden h-14 bg-slate-900 text-white flex items-center px-4 justify-between">
          <div className="flex items-center">
            <Bot className="w-5 h-5 mr-2 text-blue-400" />
            <span className="font-bold">AI Trading</span>
          </div>
          <form action="/login/actions/logout" method="POST">
            <button className="text-slate-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </form>
        </header>

        {/* Topbar (Desktop) */}
        <header className="hidden md:flex h-16 bg-white border-b border-slate-200 items-center justify-end px-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-sm font-medium text-slate-600">Connected</span>
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <span className="text-sm text-slate-500">{user.email}</span>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
        
        {/* Mobile Bottom Nav */}
        <nav className="md:hidden bg-white border-t border-slate-200 flex justify-around p-2">
          {navItems.slice(0,4).map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.name} href={item.href} className="flex flex-col items-center p-2 text-slate-500 hover:text-white hover:bg-slate-900">
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
