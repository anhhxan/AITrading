import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, CirclePlay, TrendingUp, Zap, ServerCrash, PauseCircle, Clock } from "lucide-react"

export default function DashboardOverview() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-6xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground mt-2">
          Tổng quan trạng thái hoạt động của hệ thống AI Trading.
        </p>
      </div>

      {/* Thống kê chung */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Robot Running</CardTitle>
            <CirclePlay className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paper Position</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's PnL</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">+125 USDT</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Signals</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <ServerCrash className="h-4 w-4 text-muted-foreground hidden" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-green-500 text-lg">Healthy</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Danh sách Robot hoạt động */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Trading Robots</CardTitle>
          <CardDescription>Danh sách trạng thái các Robot hiện tại.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            
            <div className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-4">
                <CirclePlay className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium leading-none">BTC Swing H3</p>
                  <p className="text-sm text-muted-foreground mt-1">Binance Paper (BTCUSDT)</p>
                </div>
              </div>
              <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/10">
                🟢 Running
              </Badge>
            </div>

            <div className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-4">
                <PauseCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium leading-none">Gold Trend</p>
                  <p className="text-sm text-muted-foreground mt-1">MT5 Paper (XAUUSD)</p>
                </div>
              </div>
              <Badge variant="outline" className="text-muted-foreground">
                ⚪ Stopped
              </Badge>
            </div>

            <div className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-4">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium leading-none">BTC Test</p>
                  <p className="text-sm text-muted-foreground mt-1">Binance Testnet (BTCUSDT)</p>
                </div>
              </div>
              <Badge variant="outline" className="text-yellow-600 border-yellow-500/20 bg-yellow-500/10">
                🟡 Waiting Signal
              </Badge>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  )
}
