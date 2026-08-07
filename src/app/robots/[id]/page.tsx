"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Square, Pause, Copy, Archive, Lock, Beaker, CheckCircle2, AlertTriangle, Download, Calendar, Search } from "lucide-react"
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
            <span>Data: Binance Futures</span>
            <span>•</span>
            <span>Exec: Paper</span>
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
          
          {/* SIMULATION UPGRADE */}
          <div className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 p-1 rounded-md">
            <Select defaultValue="100">
              <SelectTrigger className="h-8 w-[95px] border-none bg-transparent text-purple-700 font-medium">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100 Candles</SelectItem>
                <SelectItem value="500">500 Candles</SelectItem>
                <SelectItem value="1000">1000 Candles</SelectItem>
                <SelectItem value="5000">5000 Candles</SelectItem>
                <SelectItem value="custom">From - To Date</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-8 text-purple-700 hover:bg-purple-500/20 hover:text-purple-800 px-2" title="Chạy mô phỏng logic (Test Robot)">
              <Beaker className="w-4 h-4 mr-1" /> Test Robot
            </Button>
            <div className="w-px h-4 bg-purple-500/20 mx-1"></div>
            <Button variant="ghost" size="sm" className="h-8 text-purple-700 hover:bg-purple-500/20 px-2" title="Xuất CSV/JSON/TradingView Replay">
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
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 lg:grid-cols-12 mb-4 h-auto">
          <TabsTrigger value="decision" className="font-bold text-blue-600">🧠 Decision</TabsTrigger>
          <TabsTrigger value="inspector" className="font-bold text-teal-600">🔍 Inspector</TabsTrigger>
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

        {/* TAB: DECISION PANEL (FULL STEP-BY-STEP) */}
        <TabsContent value="decision" className="animate-in fade-in">
          <Card className="border-blue-500/20 shadow-md">
            <CardHeader className="bg-blue-500/5 pb-4 border-b">
              <CardTitle className="flex items-center gap-2">
                Bộ não quyết định (Decision Panel)
              </CardTitle>
              <CardDescription>
                Hiển thị từng bước suy luận logic của Strategy Plugin (BB_Strategy) trên dữ liệu của Market Data Provider.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                
                {/* Bước 1: Breakout Logic */}
                <div className="lg:col-span-2 p-4 border rounded-lg bg-card space-y-3">
                  <h4 className="font-bold text-sm border-b pb-2 flex items-center justify-between">
                    1. Breakout Signal (LONG)
                    <Badge className="bg-green-500">PASS</Badge>
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground font-semibold">Previous Candle</p>
                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                      <span>Condition:</span>
                      <span className="font-mono text-xs">Band5 &lt; Close &lt; Band4</span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                      <span>Status:</span>
                      <Badge variant="outline" className="text-green-500 border-green-500">Valid</Badge>
                    </div>
                    
                    <p className="text-muted-foreground font-semibold mt-4">Current Candle</p>
                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                      <span>Condition:</span>
                      <span className="font-mono text-xs">Close &gt; Band4</span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                      <span>Status:</span>
                      <Badge variant="outline" className="text-green-500 border-green-500">Valid</Badge>
                    </div>
                  </div>
                </div>

                {/* Bước 2: Retracement Logic */}
                <div className="lg:col-span-2 p-4 border rounded-lg bg-card space-y-3">
                  <h4 className="font-bold text-sm border-b pb-2 flex items-center justify-between">
                    2. Retracement Check
                    <Badge className="bg-green-500">PASS</Badge>
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                      <span>Retracement Target:</span>
                      <span className="font-mono font-bold text-blue-600">20% Zone</span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                      <span>Current Retracement:</span>
                      <span className="font-mono font-bold">18%</span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                      <span>Timeout Counter:</span>
                      <span className="font-mono">1 / 3 Candles</span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded border-l-4 border-l-green-500">
                      <span>Action:</span>
                      <span className="font-bold text-green-600">Enter Triggered</span>
                    </div>
                  </div>
                </div>

                {/* Bước 3: Risk & Margin */}
                <div className="lg:col-span-1 p-4 border rounded-lg bg-card space-y-3">
                  <h4 className="font-bold text-sm border-b pb-2 flex items-center justify-between">
                    3. Risk / Margin
                    <Badge className="bg-green-500">PASS</Badge>
                  </h4>
                  <div className="space-y-2 text-sm text-center pt-2">
                    <div className="p-2 border rounded bg-green-500/10 text-green-700 font-semibold mb-2">
                      Risk: 2% Balance OK
                    </div>
                    <div className="p-2 border rounded bg-green-500/10 text-green-700 font-semibold">
                      Margin: Sufficient
                    </div>
                    <div className="p-2 border rounded bg-muted text-muted-foreground mt-2">
                      Position: None
                    </div>
                  </div>
                </div>

                {/* Final Decision */}
                <div className="lg:col-span-1 p-4 border-2 border-green-500 rounded-lg text-center bg-green-500/10 relative overflow-hidden flex flex-col justify-center items-center">
                  <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
                  <p className="text-xs text-green-700 uppercase mb-2 font-bold relative z-10">Final Decision</p>
                  <span className="font-bold text-2xl text-green-600 relative z-10">BUY</span>
                  <p className="text-xs text-green-700 mt-2 relative z-10">Executing on Paper Provider...</p>
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: CANDLE INSPECTOR (MỚI) */}
        <TabsContent value="inspector" className="animate-in fade-in">
          <Card className="border-teal-500/20 shadow-sm">
            <CardHeader className="bg-teal-500/5 pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2 text-teal-700">
                <Search className="w-5 h-5" />
                Candle Inspector
              </CardTitle>
              <CardDescription>Công cụ soi siêu chi tiết dữ liệu (OHLCV, Indicator) tại cây nến hiện tại.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="space-y-3">
                <h4 className="font-bold text-sm border-b pb-2">OHLCV (2026-08-07 15:00)</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 border rounded bg-muted/50"><span className="text-muted-foreground block text-xs">Open</span><span className="font-mono">117,000</span></div>
                  <div className="p-2 border rounded bg-muted/50 border-t-2 border-t-green-500"><span className="text-muted-foreground block text-xs">High</span><span className="font-mono">118,200</span></div>
                  <div className="p-2 border rounded bg-muted/50 border-b-2 border-b-red-500"><span className="text-muted-foreground block text-xs">Low</span><span className="font-mono">116,900</span></div>
                  <div className="p-2 border rounded bg-teal-500/10 font-bold text-teal-700"><span className="text-teal-600/70 block text-xs">Close (Current)</span><span className="font-mono">118,100</span></div>
                  <div className="p-2 border rounded bg-muted/50 col-span-2"><span className="text-muted-foreground block text-xs">Volume</span><span className="font-mono">220.5 BTC</span></div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-sm border-b pb-2">Indicator Result (BB_MB)</h4>
                <div className="space-y-1 text-sm font-mono">
                  <div className="flex justify-between p-1.5 bg-muted rounded text-xs"><span className="text-muted-foreground">Band 1</span><span>119,500</span></div>
                  <div className="flex justify-between p-1.5 bg-muted rounded text-xs"><span className="text-muted-foreground">Band 2</span><span>118,900</span></div>
                  <div className="flex justify-between p-1.5 border rounded border-blue-200 bg-blue-50 text-blue-700 text-xs"><span className="font-semibold">Basis (SMA)</span><span className="font-bold">117,800</span></div>
                  <div className="flex justify-between p-1.5 border rounded border-green-200 bg-green-50 text-green-700 text-xs"><span className="font-semibold">Band 4</span><span className="font-bold">116,700</span></div>
                  <div className="flex justify-between p-1.5 bg-muted rounded text-xs"><span className="text-muted-foreground">Band 5</span><span>116,000</span></div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-sm border-b pb-2">State Machine Tracking</h4>
                <div className="p-3 border rounded bg-card space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Current State</span><Badge className="bg-yellow-500">WAIT_RETRACE</Badge></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Timeout Counter</span><span className="font-mono font-bold">1 / 3</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Entry Zone</span><span className="font-mono text-blue-600">116,000 - 116,140</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Inside Zone?</span><Badge variant="outline" className="text-green-500 border-green-500">YES</Badge></div>
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
              <CardDescription>Xác thực tính toàn vẹn của Plugin so với mã nguồn Pine Script gốc.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-6 gap-4">
              <div><p className="text-xs text-muted-foreground uppercase mb-1">Plugin Name</p><p className="font-semibold">BB_MB</p></div>
              <div><p className="text-xs text-muted-foreground uppercase mb-1">Plugin Version</p><p className="font-semibold">v1.0.0</p></div>
              <div><p className="text-xs text-muted-foreground uppercase mb-1">Pine Version</p><p className="font-semibold">v4 Standard</p></div>
              <div><p className="text-xs text-muted-foreground uppercase mb-1">Basis Method</p><Badge variant="outline" className="border-indigo-500 text-indigo-600">SMA</Badge></div>
              <div className="col-span-2"><p className="text-xs text-muted-foreground uppercase mb-1">Source Hash (SHA256)</p><p className="font-mono text-xs text-muted-foreground break-all">e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</p></div>
              <div className="col-span-6 mt-2 p-2 border-t flex justify-between items-center">
                <span className="text-sm">Status:</span>
                <Badge className="bg-green-500">✅ 100% Bit-by-bit Compatible</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cấu hình Tham số</CardTitle>
                </div>
                {isLocked && (
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-3 py-1">
                    <Lock className="w-3 h-3 mr-2" /> Configuration Locked
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2"><Label>Length</Label><Input type="number" defaultValue={20} disabled={isLocked} /></div>
                <div className="space-y-2"><Label>Mult1</Label><Input type="number" step="0.1" defaultValue={1.0} disabled={isLocked} /></div>
                <div className="space-y-2"><Label>Mult2</Label><Input type="number" step="0.1" defaultValue={2.0} disabled={isLocked} /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: DIAGNOSTICS */}
        <TabsContent value="diagnostics" className="animate-in fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Diagnostics Workspace</CardTitle>
              <CardDescription>Gom nhóm Logs, Events, Snapshots và Health Monitoring.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="events">
                <TabsList className="mb-4">
                  <TabsTrigger value="events">Event Viewer</TabsTrigger>
                  <TabsTrigger value="snapshots">Snapshot Viewer</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                  <TabsTrigger value="health">Health</TabsTrigger>
                </TabsList>
                <TabsContent value="events" className="border rounded-md p-8 text-center text-muted-foreground">
                   Event Viewer Table sẽ hiển thị tại đây.
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
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs border-green-500/50 text-green-600 hover:bg-green-50" title="So sánh Indicator Bot tính vs TV">
                      <CheckCircle2 className="w-3 h-3 mr-2" /> Verify Match
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs border-blue-500/50 text-blue-600 hover:bg-blue-50">
                      <Copy className="w-3 h-3 mr-2" /> Copy Parameters to Robot
                    </Button>
                  </div>
                </div>
                
                {/* Reference Meta Data */}
                <div className="grid grid-cols-6 gap-2 text-xs">
                  <div className="p-2 border rounded bg-card flex flex-col items-center"><span className="text-muted-foreground">Symbol</span><span className="font-mono font-bold">BINANCE:BTCUSDT.P</span></div>
                  <div className="p-2 border rounded bg-card flex flex-col items-center"><span className="text-muted-foreground">Basis / Source</span><span className="font-bold text-indigo-600">SMA / Close</span></div>
                  <div className="p-2 border rounded bg-card flex flex-col items-center"><span className="text-muted-foreground">Length/Mult</span><span className="font-bold">20 / 2 / 1</span></div>
                  <div className="p-2 border rounded bg-card flex flex-col items-center"><span className="text-muted-foreground">Exchange</span><span className="font-bold">Binance Futures</span></div>
                  <div className="p-2 border rounded bg-card flex flex-col items-center"><span className="text-muted-foreground text-center">TV Matches Core</span><span className="font-bold text-green-600">🟢 100%</span></div>
                  <div className="p-2 border rounded bg-red-500/10 flex flex-col items-center text-center"><span className="text-red-700 font-bold">Golden Rule #3</span><span className="text-[10px] text-red-600">TV is NOT signal source</span></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
               <TradingViewWidget />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Các Tab khác: Overview, Strategy, Entry, Exit, Risk, Position, Timeline */}
        
      </Tabs>
    </div>
  )
}
