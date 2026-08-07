"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Square, Pause, Copy, Archive, CheckCircle2, AlertTriangle, Download, Search, Server, Database, History, Braces, XCircle, ArrowRight, Save, Route } from "lucide-react"
import TradingViewWidget from "@/components/robots/TradingViewWidget"

export default function RobotDetail() {
  const [robotState, setRobotState] = useState("RUNNING")
  const [pendingChanges, setPendingChanges] = useState(false)
  
  const isLocked = robotState !== "CREATED" && robotState !== "STOPPED"

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
      
      {/* 1. ROBOT HEADER & INTEGRITY PANEL */}
      <div className="flex flex-col gap-4">
        
        {/* Header Main */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-xl bg-card shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">BTC Swing H3</h2>
              <Badge variant="outline" className={robotState === "RUNNING" ? "border-green-500 text-green-500 bg-green-500/10" : "border-yellow-500 text-yellow-600 bg-yellow-500/10"}>
                {robotState === "RUNNING" ? "🟢 Running" : `🟡 ${robotState}`}
              </Badge>
              {pendingChanges && (
                <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-500/10">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Pending Changes (Stop to Apply)
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
              <span className="text-foreground">Robot v1.0.0</span>
              <span>•</span>
              <span className="font-bold text-blue-600">Engine v1.8.3</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Badge variant="secondary">BB_MB v1.0.0</Badge></span>
              <span>•</span>
              <span className="flex items-center gap-1"><Badge variant="secondary">BB_Strategy v1.0</Badge></span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {robotState === "RUNNING" ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setRobotState("PAUSED")} className="border-yellow-500 text-yellow-600 hover:bg-yellow-50">
                  <Pause className="w-4 h-4 mr-2" /> Pause
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setRobotState("STOPPED")}>
                  <Square className="w-4 h-4 mr-2" /> Stop Robot
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setRobotState("RUNNING")} className="bg-green-600 hover:bg-green-700">
                <Play className="w-4 h-4 mr-2" /> Start (v1.1)
              </Button>
            )}
            
            <div className="w-px h-6 bg-border mx-2"></div>
            <Button variant="outline" size="sm" title="Clone"><Copy className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" title="Archive"><Archive className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* MỚI: Market Data Integrity Panel */}
        <Card className="border-blue-500/20 bg-blue-500/5 shadow-sm">
          <CardHeader className="py-2 px-4 border-b bg-background/50">
            <CardTitle className="text-sm flex items-center justify-between text-blue-700">
              <div className="flex items-center gap-2"><Database className="w-4 h-4" /> Market Data Integrity Panel</div>
              <Badge className="bg-green-500">100% Clean Data</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-xs font-mono">
              <div><span className="text-muted-foreground block font-sans">Provider</span><span className="font-bold text-green-600">Binance Futures</span></div>
              <div><span className="text-muted-foreground block font-sans">Symbol</span><span className="font-bold">BTCUSDT</span></div>
              <div><span className="text-muted-foreground block font-sans">Interval</span><span className="font-bold">3H</span></div>
              <div><span className="text-muted-foreground block font-sans">Exchange Time</span><span className="font-bold">UTC</span></div>
              <div className="col-span-2"><span className="text-muted-foreground block font-sans">First Candle</span><span>2026-01-01 00:00:00</span></div>
              <div className="col-span-2"><span className="text-muted-foreground block font-sans">Last Candle</span><span className="text-blue-600 font-bold">2026-08-07 12:00:00</span></div>
              <div><span className="text-muted-foreground block font-sans">Missing Candles</span><span className="text-green-600 font-bold">0</span></div>
              <div><span className="text-muted-foreground block font-sans">Duplicate Candles</span><span className="text-green-600 font-bold">0</span></div>
              <div><span className="text-muted-foreground block font-sans">WebSocket</span><span className="text-green-600 font-bold">Connected</span></div>
              <div><span className="text-muted-foreground block font-sans">Latency</span><span>48 ms</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. MAIN TABS (Enterprise Structure) */}
      <Tabs defaultValue="decision" className="w-full">
        <TabsList className="flex flex-wrap w-full mb-4 h-auto justify-start gap-1">
          <TabsTrigger value="decision" className="font-bold text-blue-600">🧠 Decision</TabsTrigger>
          <TabsTrigger value="graph" className="font-bold text-orange-600">Dependency Graph</TabsTrigger>
          <TabsTrigger value="inspector">Candle Inspector</TabsTrigger>
          <TabsTrigger value="indicator">Configuration (Freeze)</TabsTrigger>
          <TabsTrigger value="tv" className="font-bold text-indigo-600">TradingView Verify++</TabsTrigger>
          <TabsTrigger value="replay" className="font-bold text-purple-600">Replay / Simulator</TabsTrigger>
          <TabsTrigger value="diagnostics" className="font-bold text-red-600">Diagnostics Workspace</TabsTrigger>
        </TabsList>

        {/* TAB: DECISION PANEL (MỚI: Decision Trace ID) */}
        <TabsContent value="decision" className="animate-in fade-in">
          <Card className="border-blue-500/20 shadow-md">
            <CardHeader className="bg-blue-500/5 pb-4 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">Bộ não quyết định (Decision Panel)</CardTitle>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Decision Trace ID</span>
                  <span className="font-mono text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">b13c4f2a-99e8-4231-ab11-f923b7a89100</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                <div className="lg:col-span-1 p-4 border rounded-lg bg-card space-y-3">
                  <h4 className="font-bold text-sm border-b pb-2">Market Data Snapshot</h4>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Current Price</span><span className="font-bold text-green-600">118,250</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Band 1 (Outer)</span><span className="font-mono">119,500</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Band 4 (Inner)</span><span className="font-mono font-bold text-blue-600">118,180</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Band 5 (Outer)</span><span className="font-mono">117,900</span></div>
                </div>

                <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded text-center bg-card">
                    <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Breakout Signal</p>
                    <Badge className="bg-green-500 mb-1">LONG SIGNAL</Badge>
                  </div>
                  <div className="p-4 border rounded text-center bg-card">
                    <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Retracement</p>
                    <Badge variant="outline" className="border-blue-500 text-blue-500 mb-1">READY</Badge>
                  </div>
                  <div className="p-4 border rounded text-center bg-card">
                    <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Risk/Margin</p>
                    <Badge variant="outline" className="border-green-500 text-green-500 mb-1">PASS</Badge>
                  </div>
                  <div className="p-4 border-2 border-green-500 rounded bg-green-500/10 flex flex-col justify-center items-center">
                    <p className="text-xs text-green-700 uppercase mb-2 font-bold">Final Decision</p>
                    <span className="font-bold text-2xl text-green-600">BUY</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: DEPENDENCY GRAPH */}
        <TabsContent value="graph" className="animate-in fade-in">
          <Card className="border-orange-500/20 shadow-sm">
            <CardHeader className="bg-orange-500/5 pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
                <Route className="w-5 h-5" /> Robot Dependency Graph
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-10 pb-10 flex flex-col items-center justify-center">
              <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4 w-full">
                <Badge variant="outline" className="p-3 text-sm bg-blue-50">Market Data</Badge>
                <ArrowRight className="text-muted-foreground w-4 h-4" />
                <Badge variant="outline" className="p-3 text-sm border-indigo-500 text-indigo-700">BB_MB (v1.0.0)</Badge>
                <ArrowRight className="text-muted-foreground w-4 h-4" />
                <Badge variant="outline" className="p-3 text-sm border-indigo-500 text-indigo-700">BB_Strategy (v1.0)</Badge>
                <ArrowRight className="text-muted-foreground w-4 h-4" />
                <Badge variant="outline" className="p-3 text-sm border-teal-500 text-teal-700">Kelly Risk</Badge>
                <ArrowRight className="text-muted-foreground w-4 h-4" />
                <Badge variant="outline" className="p-3 text-sm border-red-500 text-red-700">ATR Exit (v2.0)</Badge>
                <ArrowRight className="text-muted-foreground w-4 h-4" />
                <Badge variant="outline" className="p-3 text-sm bg-purple-50">Execution Engine</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: INDICATOR (FREEZE LOGIC) */}
        <TabsContent value="indicator" className="animate-in fade-in">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Configuration Freeze Control</CardTitle>
                  <CardDescription>Sửa cấu hình khi Bot đang chạy sẽ tạo Pending Changes.</CardDescription>
                </div>
                {pendingChanges && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setPendingChanges(false)}>
                      <XCircle className="w-4 h-4 mr-2" /> Discard Pending
                    </Button>
                    <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                      <Search className="w-4 h-4 mr-2" /> Compare Pending
                    </Button>
                    <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => { setRobotState("STOPPED"); setPendingChanges(false); }}>
                      <Save className="w-4 h-4 mr-2" /> Stop & Apply Pending
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                
                {/* Compare Highlight Simulation */}
                {pendingChanges && <div className="absolute inset-0 bg-orange-500/5 pointer-events-none rounded-lg border-2 border-dashed border-orange-500/20 z-0"></div>}

                <div className="space-y-2 relative z-10">
                  <Label>Length</Label>
                  <div className="relative">
                    <Input type="number" defaultValue={pendingChanges ? 30 : 20} onChange={() => setPendingChanges(true)} 
                           className={pendingChanges ? "border-orange-500 bg-orange-50 text-orange-700 font-bold" : ""} />
                    {pendingChanges && <span className="absolute right-3 top-2 text-xs text-muted-foreground line-through">20</span>}
                  </div>
                </div>
                <div className="space-y-2 relative z-10">
                  <Label>Mult1</Label>
                  <Input type="number" step="0.1" defaultValue={1.0} onChange={() => setPendingChanges(true)} />
                </div>
                <div className="space-y-2 relative z-10">
                  <Label>Mult2</Label>
                  <Input type="number" step="0.1" defaultValue={2.0} onChange={() => setPendingChanges(true)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: TRADINGVIEW VERIFY++ LEVEL 2 */}
        <TabsContent value="tv" className="animate-in fade-in h-[850px]">
          <Card className="h-full flex flex-col border-indigo-500/20 shadow-sm">
            <CardHeader className="py-3 px-4 border-b bg-indigo-500/5">
              <div className="flex justify-between items-center mb-3">
                <CardTitle className="text-base text-indigo-700 font-bold flex items-center gap-2">TradingView Verify++ (Data Difference)</CardTitle>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow"><CheckCircle2 className="w-3 h-3 mr-2" /> Verify Match Now</Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 border border-indigo-200 bg-indigo-50/50 rounded flex flex-col gap-2">
                  <span className="text-xs font-bold text-indigo-700 uppercase border-b border-indigo-100 pb-1">Level 1: Indicator Precision Matching</span>
                  <div className="grid grid-cols-5 text-xs font-mono gap-1 text-center">
                    <div className="font-bold text-muted-foreground text-left">Metric</div>
                    <div className="font-bold">TV Value</div>
                    <div className="font-bold">Robot Value</div>
                    <div className="font-bold">Difference</div>
                    <div className="font-bold">Match</div>
                    <div className="col-span-5 border-b my-1"></div>
                    <div className="text-left font-semibold">Close</div><div>112300</div><div>112300</div><div>0</div><div className="text-green-600">YES 🟢</div>
                    <div className="text-left font-semibold text-blue-600">SMA (B3)</div><div>117800</div><div>117800</div><div className="text-orange-500">0.00000001</div><div className="text-orange-500">99.99% 🟡</div>
                    <div className="text-left font-semibold">Band 4</div><div>116700</div><div>116700</div><div>0</div><div className="text-green-600">YES 🟢</div>
                  </div>
                </div>
                <div className="p-3 border border-indigo-200 bg-indigo-50/50 rounded flex flex-col gap-2">
                  <span className="text-xs font-bold text-indigo-700 uppercase border-b border-indigo-100 pb-1">Level 2: Strategy Signal Matching</span>
                  <div className="grid grid-cols-4 text-xs font-mono gap-1 text-center">
                    <div className="font-bold text-muted-foreground text-left">Metric</div>
                    <div className="font-bold">TV Strategy</div>
                    <div className="font-bold">Robot Strategy</div>
                    <div className="font-bold">Match</div>
                    <div className="col-span-4 border-b my-1"></div>
                    <div className="text-left font-semibold text-orange-600">SIGNAL</div>
                    <div className="font-bold">LONG</div>
                    <div className="font-bold">LONG</div>
                    <div className="text-green-600">YES 🟢</div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
               <TradingViewWidget />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: REPLAY DEBUGGER & DATA RECORDER */}
        <TabsContent value="replay" className="animate-in fade-in">
          <Card className="border-purple-500/20 shadow-sm">
            <CardHeader className="bg-purple-500/5 pb-4 border-b">
              <CardTitle className="text-lg flex items-center justify-between text-purple-700">
                <div className="flex items-center gap-2"><History className="w-5 h-5" /> Replay Engine & Dataset Recorder</div>
                <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50 animate-pulse flex gap-1 items-center">
                  <div className="w-2 h-2 rounded-full bg-red-600"></div> Recording Dataset for Reproducibility
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex gap-4 mb-6 p-4 border rounded bg-muted/30">
                <div className="space-y-2 flex-1">
                  <Label>Break Point (Stop when...)</Label>
                  <Select defaultValue="buy">
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Điều kiện dừng" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long">LONG SIGNAL</SelectItem>
                      <SelectItem value="buy">BUY EXECUTED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white w-32"><Play className="w-4 h-4 mr-2"/> Start Replay</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: DIAGNOSTICS WORKSPACE */}
        <TabsContent value="diagnostics" className="animate-in fade-in">
          <Card className="border-red-500/20 shadow-md">
            <CardHeader className="bg-red-500/5 pb-0 border-b">
              <CardTitle className="flex items-center gap-2 text-red-700 mb-4">Diagnostics Workspace</CardTitle>
              <Tabs defaultValue="events" className="w-full">
                <TabsList className="mb-0 bg-transparent border-b rounded-none w-full justify-start h-auto p-0">
                  <TabsTrigger value="events" className="data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none pb-2">Events</TabsTrigger>
                  <TabsTrigger value="logs" className="data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none pb-2">Logs</TabsTrigger>
                  <TabsTrigger value="snapshots" className="data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none pb-2">Snapshots</TabsTrigger>
                  <TabsTrigger value="runtime" className="data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none pb-2">Runtime Health</TabsTrigger>
                </TabsList>
                
                <TabsContent value="events" className="p-4 bg-card mt-0 min-h-[300px]">
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex gap-4 p-2 border-b"><span className="text-muted-foreground w-8">#3</span><span>[State Machine] State changed to WAIT_RETRACE</span></div>
                    <div className="flex gap-4 p-2 border-b"><span className="text-muted-foreground w-8">#2</span><span>[Strategy] Breakout evaluated to TRUE</span></div>
                    <div className="flex gap-4 p-2 border-b"><span className="text-muted-foreground w-8">#1</span><span>[Indicator] Computed BB_MB v1.0.0</span></div>
                  </div>
                </TabsContent>
                <TabsContent value="logs" className="p-4 bg-card mt-0 min-h-[300px]">System Logs...</TabsContent>
                <TabsContent value="snapshots" className="p-4 bg-card mt-0 min-h-[300px]">Snapshot Viewer...</TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
        </TabsContent>

        {/* CÁC TAB ẨN ĐỂ ĐÚNG CẤU TRÚC: inspector */}
        <TabsContent value="inspector">...</TabsContent>

      </Tabs>
    </div>
  )
}
