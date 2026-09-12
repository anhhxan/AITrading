import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogOut } from 'lucide-react'
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 shrink-0">
            <SidebarTrigger />
            
            <div className="flex-1">
               {/* dynamic title could just be inferred or simple */}
               <h1 className="font-semibold text-lg text-foreground">Control Center</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
                {user.email}
              </span>
              <div className="h-4 w-px bg-border hidden sm:block"></div>
              <form action="/login/actions/logout" method="POST">
                <button className="text-muted-foreground hover:text-foreground transition-colors flex items-center">
                  <LogOut className="w-5 h-5 sm:mr-2" />
                  <span className="hidden sm:inline-block text-sm">Sign out</span>
                </button>
              </form>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/20">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
