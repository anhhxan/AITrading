"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Square, Pause, Copy, Archive, Lock, Beaker, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Download, Activity } from "lucide-react"
import TradingViewWidget from "@/components/robots/TradingViewWidget"

export default function RobotDetail() {
  const [robotState, setRobotState] = useState("RUNNING")
  const isLocked = robotState !== "CREATED" && robotState !== "STOPPED"

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
      
      {/* 1. ROBOT HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-xl bg-card shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">BTC Swing H3</h2>
            <Badge variant="outline" className={robotState === "RUNNING" ? "border-green-500 text-green-500 bg-green-500/10" : "border-yellow-500 text-yellow-600 bg-yellow-500/10"}>
              {robotState === "RUNNING" ? "🟢 Running" : `🟡 ${robotState}`}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
            <span className="text-foreground">Version 1.0.0</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Badge variant="secondary">BB+MB</Badge></span>
            <span>•</span>
            <span className="text-foreground">BTCUSDT</span>
            <span>•</span>
            <span className="text-foreground">3H</span>
            <span>•</span>
            <span>Paper Trading</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {robotState === "RUNNING" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setRobotState("PAUSED")} className="border-yellow-500 text-yellow-600 hover:bg-yellow-50">
                <Pause className="w-4 h-4 mr-2" /> Pause
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setRobotState("STOPPED")}>
                <Square className="w-4 h-4 mr-2" /> Stop
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setRobotState("RUNNING")} className="bg-green-600 hover:bg-green-700">
              <Play className="w-4 h-4 mr-2" /> Start
            </Button>
          )}
          
          <div className="w-px h-6 bg-border mx-2"></div>
          
          <div className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 p-1 rounded-md">
            <Select defaultValue="100">
              <SelectTrigger className="h-8 w-[90px] border-none bg-transparent text-purple-700 font-medium">
                <SelectValue placeholder="Candles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100 Candles</SelectItem>
                <SelectItem value="500">500 Candles</SelectItem>
                <SelectItem value="1000">1000 Candles</SelectItem>
                <SelectItem value="5000">5000 Candles</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-8 text-purple-700 hover:bg-purple-500/20 hover:text-purple-800 px-2" title="Chạy mô phỏng logic">
              <Beaker className="w-4 h-4 mr-1" /> Test Robot
            </Button>
            <div className="w-px h-4 bg-purple-500/20 mx-1"></div>
            <Button variant="ghost" size="sm" className="h-8 text-purple-700 hover:bg-purple-500/20 px-2" title="Xuất kết quả mô phỏng (CSV/JSON/TradingView)">
              <Download className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-px h-6 bg-border mx-2"></div>
          
          <Button variant="outline" size="sm" title="Clone">
            <Copy className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" title="Archive">
            <Archive className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 2. MAIN TABS */}
      <Tabs defaultValue="decision" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 lg:grid-cols-11 mb-4 h-auto">
          <TabsTrigger value="decision" className="font-bold text-blue-600">🧠 Decision</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="indicator">Indicator</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="entry">Entry</TabsTrigger>
          <TabsTrigger value="exit">Exit</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="position">Position</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="tv">TradingView</TabsTrigger>
        </TabsList>

        {/* TAB: DECISION PANEL (UPDATE) */}
        <TabsContent value="decision" className="animate-in fade-in">
          <Card className="border-blue-500/20 shadow-md">
            <CardHeader className="bg-blue-500/5 pb-4 border-b">
              <CardTitle className="flex items-center gap-2">
                Bộ não quyết định (Decision Panel)
              </CardTitle>
              <CardDescription>
                Theo dõi chính xác cách Robot phân tích thị trường ở thời điểm hiện tại (Realtime).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Khối Data */}
                <div className="lg:col-span-1 p-4 border rounded-lg bg-card space-y-3">
                  <h4 className="font-bold text-sm border-b pb-2">Market Data Snapshot</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Price</span>
                    <span className="font-bold text-green-600">118,250</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Band 1 (Outer)</span>
                    <span className="font-mono">119,500</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Band 2 (Inner)</span>
                    <span className="font-mono">119,100</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Band 3 (SMA)</span>
                    <span className="font-mono text-blue-600">118,640</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Band 4 (Inner)</span>
                    <span className="font-mono font-bold">118,180</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Band 5 (Outer)</span>
                    <span className="font-mono">117,900</span>
                  </div>
                </div>

                {/* Khối Logic */}
                <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                  
                  <div className="p-4 border rounded-lg text-center bg-card">
                    <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Breakout Signal</p>
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-sm font-mono mb-1">Dist: +70</div>
                      <Badge className="bg-green-500 hover:bg-green-600">LONG SIGNAL</Badge>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg text-center bg-card">
                    <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Retracement</p>
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-sm font-mono mb-1">Zone: 56 | In: YES</div>
                      <Badge variant="outline" className="border-blue-500 text-blue-500">READY</Badge>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg text-center bg-card">
                    <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Risk & Margin</p>
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-sm font-mono mb-1">Timeout: 2/3</div>
                      <Badge variant="outline" className="border-green-500 text-green-500">PASS</Badge>
                    </div>
                  </div>

                  <div className="p-4 border-2 border-green-500 rounded-lg text-center bg-green-500/10 relative overflow-hidden flex flex-col justify-center items-center">
                    <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
                    <p className="text-xs text-green-700 uppercase mb-2 font-bold relative z-10">Final Decision</p>
                    <span className="font-bold text-xl text-green-600 relative z-10">READY_TO_BUY</span>
                  </div>

                </div>

              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: INDICATOR */}
        <TabsContent value="indicator" className="animate-in fade-in space-y-6">
          
          <Card className="border-indigo-500/20 shadow-sm">
            <CardHeader className="bg-indigo-500/5 pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                Indicator Verification Panel
              </CardTitle>
              <CardDescription>Xác thực tính tương thích của Plugin với mã nguồn Pine Script gốc.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Plugin Name</p>
                <p className="font-semibold text-foreground">BB_MB</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Pine Version</p>
                <p className="font-semibold text-foreground">v4 Standard</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Basis Method</p>
                <Badge variant="outline" className="border-indigo-500 text-indigo-600">SMA (Simple Moving Average)</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Source Price</p>
                <p className="font-semibold text-foreground">Close</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Compatibility Status</p>
                <Badge className="bg-green-500">✅ 100% Bit-by-bit Compatible</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cấu hình Indicator: BB_MB</CardTitle>
                  <CardDescription>Tham số tính toán dải Bollinger Bands.</CardDescription>
                </div>
                {isLocked && (
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-3 py-1">
                    <Lock className="w-3 h-3 mr-2" /> Configuration Locked
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Length (Chu kỳ)</Label>
                  <Input type="number" defaultValue={20} disabled={isLocked} />
                </div>
                <div className="space-y-2">
                  <Label>Mult1 (Độ lệch chuẩn vòng trong)</Label>
                  <Input type="number" step="0.1" defaultValue={1.0} disabled={isLocked} />
                </div>
                <div className="space-y-2">
                  <Label>Mult2 (Độ lệch chuẩn vòng ngoài)</Label>
                  <Input type="number" step="0.1" defaultValue={2.0} disabled={isLocked} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: TIMELINE */}
        <TabsContent value="timeline" className="animate-in fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Lịch sử ra quyết định chi tiết từ Event Bus.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative border-l-2 border-muted ml-4 md:ml-10 space-y-6 py-4">
                
                <div className="relative flex items-start">
                  <div className="absolute -left-[9px] w-4 h-4 bg-background border-2 border-yellow-500 rounded-full mt-1.5"></div>
                  <div className="pl-6 w-full max-w-2xl">
                    <div className="p-4 bg-card border rounded-lg shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <Badge variant="outline" className="text-yellow-600 bg-yellow-500/10">LONG SIGNAL</Badge>
                        <span className="text-xs text-muted-foreground">17:00 PM</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                        <div className="text-muted-foreground">Price: <span className="font-medium text-foreground">118,250</span></div>
                        <div className="text-muted-foreground">Reason: <span className="font-medium text-foreground">Breakout Band 4 (118,180)</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-start">
                  <div className="absolute -left-[9px] w-4 h-4 bg-background border-2 border-green-500 rounded-full mt-1.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full m-[2px] animate-ping"></div>
                  </div>
                  <div className="pl-6 w-full max-w-2xl">
                    <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <Badge variant="outline" className="text-green-600 bg-green-500/10">READY TO BUY</Badge>
                        <span className="text-xs text-muted-foreground">17:45 PM (Current)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                        <div className="text-muted-foreground">Price: <span className="font-medium text-foreground">118,020</span></div>
                        <div className="text-muted-foreground">Retracement: <span className="font-medium text-foreground">Inside 20% Zone</span></div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: DIAGNOSTICS */}
        <TabsContent value="diagnostics" className="animate-in fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Diagnostics</CardTitle>
              <CardDescription>Công cụ phân tích, debug và giám sát sức khỏe toàn diện.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="events" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="events">Event Viewer</TabsTrigger>
                  <TabsTrigger value="snapshots">Snapshot Viewer</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                  <TabsTrigger value="health">Health</TabsTrigger>
                </TabsList>
                
                <TabsContent value="events" className="border rounded-md">
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                      <span className="font-mono text-xs w-24">17:45:10</span>
                      <Badge variant="outline" className="w-24 text-center border-blue-500 text-blue-600">STATE</Badge>
                      <span className="flex-1 px-4">State transitioned to READY_TO_ENTER</span>
                    </div>
                    <div className="flex items-center justify-between text-sm p-2 border-b">
                      <span className="font-mono text-xs w-24">17:00:00</span>
                      <Badge variant="outline" className="w-24 text-center text-yellow-600 border-yellow-500">SIGNAL</Badge>
                      <span className="flex-1 px-4 text-yellow-600">LONG SIGNAL detected at price 118250</span>
                    </div>
                    <div className="flex items-center justify-between text-sm p-2 border-b">
                      <span className="font-mono text-xs w-24">16:15:00</span>
                      <Badge variant="outline" className="w-24 text-center text-red-600 border-red-500">ERROR</Badge>
                      <span className="flex-1 px-4 text-red-600">Binance API Rate Limit</span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="snapshots" className="border rounded-md p-8 text-center text-muted-foreground">
                   Click vào một Trade History ở tab Position để xem cấu hình Risk, State và Indicator tại thời điểm vào lệnh.
                </TabsContent>

              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: TRADINGVIEW */}
        <TabsContent value="tv" className="animate-in fade-in h-[750px]">
          <Card className="h-full flex flex-col border-blue-500/20">
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base text-blue-600 font-bold flex items-center gap-2">
                      TradingView Reference Panel
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Quy tắc hệ thống:</strong> TradingView KHÔNG sinh tín hiệu, KHÔNG gọi API giao dịch. Mọi quyết định do Core Engine thực hiện 100% theo Pine Script.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-xs border-blue-500/50 text-blue-600 hover:bg-blue-50">
                    <Copy className="w-3 h-3 mr-2" /> Copy Parameters to Robot
                  </Button>
                </div>
                
                {/* Reference Meta Data */}
                <div className="grid grid-cols-6 gap-2 text-xs">
                  <div className="p-2 border rounded bg-card flex flex-col items-center"><span className="text-muted-foreground">Indicator</span><span className="font-bold">BB+MB</span></div>
                  <div className="p-2 border rounded bg-card flex flex-col items-center"><span className="text-muted-foreground">Basis</span><span className="font-bold text-indigo-600">SMA</span></div>
                  <div className="p-2 border rounded bg-card flex flex-col items-center"><span className="text-muted-foreground">Length/Mult</span><span className="font-bold">20 / 2 / 1</span></div>
                  <div className="p-2 border rounded bg-card flex flex-col items-center"><span className="text-muted-foreground">Source</span><span className="font-bold">Close</span></div>
                  <div className="p-2 border rounded bg-card flex flex-col items-center"><span className="text-muted-foreground">Exchange</span><span className="font-bold">Binance Futures</span></div>
                  <div className="p-2 border rounded bg-card flex flex-col items-center"><span className="text-muted-foreground">Compatibility</span><span className="font-bold text-green-600">✅ Synced</span></div>
                </div>

              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
               <TradingViewWidget />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
