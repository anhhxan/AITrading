"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Square, Pause, Copy, Archive, Lock, Beaker, CheckCircle2, AlertTriangle, Download, Search, Server, Database, History, Braces, LockOpen, XCircle } from "lucide-react"
import TradingViewWidget from "@/components/robots/TradingViewWidget"

export default function RobotDetail() {
  const [robotState, setRobotState] = useState("RUNNING")
  const [pendingChanges, setPendingChanges] = useState(false)
  
  const isLocked = robotState !== "CREATED" && robotState !== "STOPPED"

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
      
      {/* 1. ROBOT HEADER & MONITORS */}
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
              <span className="text-foreground">BTCUSDT (3H)</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Badge variant="secondary">BB_MB v1.0.0</Badge></span>
              <span>•</span>
              <span className="flex items-center gap-1"><Badge variant="secondary">BB_Strategy v1.0</Badge></span>
              <span>•</span>
              <span className="flex items-center gap-1"><Badge variant="secondary">ATR Exit v2.0</Badge></span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {robotState === "RUNNING" ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setRobotState("PAUSED")} className="border-yellow-500 text-yellow-600 hover:bg-yellow-50">
                  <Pause className="w-4 h-4 mr-2" /> Pause
                </Button>
                <Button variant="destructive" size="sm" onClick={() => { setRobotState("STOPPED"); setPendingChanges(false); }}>
                  <Square className="w-4 h-4 mr-2" /> Stop & Apply
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setRobotState("RUNNING")} className="bg-green-600 hover:bg-green-700">
                <Play className="w-4 h-4 mr-2" /> Start (v1.1)
              </Button>
            )}
            
            <div className="w-px h-6 bg-border mx-2"></div>
            
            {/* SIMULATION UPGRADE */}
            <div className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 p-1 rounded-md">
              <Select defaultValue="custom">
                <SelectTrigger className="h-8 w-[95px] border-none bg-transparent text-purple-700 font-medium">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 Candles</SelectItem>
                  <SelectItem value="500">500 Candles</SelectItem>
                  <SelectItem value="custom">From - To Date</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-8 text-purple-700 hover:bg-purple-500/20 px-2" title="Chạy mô phỏng logic">
                <Beaker className="w-4 h-4 mr-1" /> Test Robot
              </Button>
              <div className="w-px h-4 bg-purple-500/20 mx-1"></div>
              <Button variant="ghost" size="sm" className="h-8 text-purple-700 hover:bg-purple-500/20 px-2">
                <Download className="w-4 h-4" />
              </Button>
            </div>

            <div className="w-px h-6 bg-border mx-2"></div>
            <Button variant="outline" size="sm" title="Clone"><Copy className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" title="Archive"><Archive className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Monitors (Market Data, Runtime, Readiness) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Market Data Monitor */}
          <Card className="border-blue-500/20 bg-blue-500/5 shadow-sm">
            <CardHeader className="py-2 px-4 border-b bg-background/50">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                <Database className="w-4 h-4" /> Market Data Monitor
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground block">Provider</span><span className="font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500"/> Binance Futures</span></div>
                <div><span className="text-muted-foreground block">Latency</span><span className="font-mono">48 ms</span></div>
                <div><span className="text-muted-foreground block">WebSocket</span><span className="font-bold flex items-center gap-1 text-green-600">Connected</span></div>
                <div><span className="text-muted-foreground block">Data Delay</span><span className="font-mono text-green-600">0.0 sec</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Robot Runtime Monitor */}
          <Card className="border-green-500/20 bg-green-500/5 shadow-sm">
            <CardHeader className="py-2 px-4 border-b bg-background/50">
              <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                <Server className="w-4 h-4" /> Robot Runtime Monitor
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4">
              <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-xs">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="font-semibold">Indicator Engine</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="font-semibold">Strategy Engine</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="font-semibold">State Machine</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="font-semibold">Risk Engine</span></div>
              </div>
            </CardContent>
          </Card>

          {/* MỚI: Robot Readiness Score */}
          <Card className="border-purple-500/20 bg-purple-500/5 shadow-sm">
            <CardHeader className="py-2 px-4 border-b bg-background/50">
              <CardTitle className="text-sm flex items-center justify-between text-purple-700">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Readiness Score</div>
                <Badge className="bg-purple-600">95%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4">
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <div className="flex items-center justify-between pr-4"><span className="text-muted-foreground">Provider</span><span>✅</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Market Data</span><span>✅</span></div>
                <div className="flex items-center justify-between pr-4"><span className="text-muted-foreground">Strategy</span><span>✅</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Simulation</span><span title="Chưa chạy đủ 1000 nến">❌</span></div>
                <div className="col-span-2 text-[10px] text-red-500 mt-1 font-semibold">Chưa đủ điều kiện chạy LIVE (Fail Simulation).</div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* MỚI: Compatibility Checker */}
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-700 rounded-lg flex items-center gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p>
            <strong>Compatibility Warning:</strong> Plugin <code>BB Strategy v1.0</code> không hoàn toàn tương thích với <code>ATR Exit v2.0</code>. 
            Vui lòng nâng cấp BB Strategy lên v1.1 hoặc dùng Strategy Exit v1.
          </p>
        </div>
      </div>

      {/* 2. MAIN TABS */}
      <Tabs defaultValue="decision" className="w-full">
        <TabsList className="flex flex-wrap w-full mb-4 h-auto justify-start gap-1">
          <TabsTrigger value="decision" className="font-bold text-blue-600">🧠 Decision</TabsTrigger>
          <TabsTrigger value="inspector" className="font-bold text-teal-600">🔍 Candle Inspector</TabsTrigger>
          <TabsTrigger value="context" className="font-bold text-orange-600">JSON Context</TabsTrigger>
          <TabsTrigger value="indicator">Indicator</TabsTrigger>
          <TabsTrigger value="tv" className="font-bold text-indigo-600">TradingView Verify++</TabsTrigger>
          <TabsTrigger value="replay" className="font-bold text-purple-600">Replay Debugger</TabsTrigger>
        </TabsList>

        {/* TAB: DECISION PANEL */}
        <TabsContent value="decision" className="animate-in fade-in">
          <Card className="border-blue-500/20 shadow-md">
            <CardHeader className="bg-blue-500/5 pb-4 border-b">
              <CardTitle className="flex items-center gap-2">Bộ não quyết định (Decision Panel)</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                <div className="lg:col-span-1 p-4 border rounded-lg bg-card space-y-3">
                  <h4 className="font-bold text-sm border-b pb-2">Market Data Snapshot</h4>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Current Price</span><span className="font-bold text-green-600">118,250</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Band 1 (Outer)</span><span className="font-mono">119,500</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Band 3 (SMA)</span><span className="font-mono text-blue-600">118,640</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Band 4 (Inner)</span><span className="font-mono font-bold">118,180</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Band 5 (Outer)</span><span className="font-mono">117,900</span></div>
                </div>

                <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded text-center bg-card">
                    <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Breakout Signal</p>
                    <Badge className="bg-green-500 mb-1">LONG SIGNAL</Badge>
                    <div className="text-xs font-mono text-muted-foreground">Prev: Valid<br/>Curr: Valid</div>
                  </div>
                  <div className="p-4 border rounded text-center bg-card">
                    <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Retracement</p>
                    <Badge variant="outline" className="border-blue-500 text-blue-500 mb-1">READY</Badge>
                    <div className="text-xs font-mono text-muted-foreground">Zone: 18%<br/>Timeout: 1/3</div>
                  </div>
                  <div className="p-4 border rounded text-center bg-card">
                    <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Risk/Margin</p>
                    <Badge variant="outline" className="border-green-500 text-green-500 mb-1">PASS</Badge>
                    <div className="text-xs font-mono text-muted-foreground">Risk: 2% OK<br/>Margin: OK</div>
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

        {/* TAB: CANDLE INSPECTOR */}
        <TabsContent value="inspector" className="animate-in fade-in">
          <Card className="border-teal-500/20 shadow-sm">
            <CardHeader className="bg-teal-500/5 pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2 text-teal-700">
                <Search className="w-5 h-5" /> Candle Inspector
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="font-bold text-sm border-b pb-2 text-teal-700">OHLCV (2026-08-07 15:00)</h4>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground">Open</span><span>117,000</span></div>
                  <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground text-green-600">High</span><span className="text-green-600">118,200</span></div>
                  <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground text-red-600">Low</span><span className="text-red-600">116,900</span></div>
                  <div className="flex justify-between border-b pb-1 font-bold"><span className="text-teal-600">Close</span><span>118,100</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: ROBOT CONTEXT VIEWER */}
        <TabsContent value="context" className="animate-in fade-in">
          <Card className="border-orange-500/20 shadow-sm">
            <CardHeader className="bg-orange-500/5 pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
                <Braces className="w-5 h-5" /> Robot Context Viewer
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <pre className="p-4 rounded bg-zinc-950 text-green-400 font-mono text-xs h-[300px] overflow-auto">
{`{
  "id": "BTC_Swing_H3",
  "symbol": "BTCUSDT",
  "timeframe": "3H",
  "state": { "current": "WAIT_RETRACE", "timeout": 1 },
  "indicator_results": { ... }
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: INDICATOR (FREEZE LOGIC) */}
        <TabsContent value="indicator" className="animate-in fade-in">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cấu hình Tham số Indicator</CardTitle>
                  <CardDescription>Sửa khi Bot đang chạy sẽ tạo Pending Changes.</CardDescription>
                </div>
                {isLocked && (
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/50 px-3 py-1">
                    <Lock className="w-3 h-3 mr-2" /> Configuration Locked (Freeze Mode)
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Length</Label>
                  <Input type="number" defaultValue={20} onChange={() => setPendingChanges(true)} />
                </div>
                <div className="space-y-2">
                  <Label>Mult1</Label>
                  <Input type="number" step="0.1" defaultValue={1.0} onChange={() => setPendingChanges(true)} />
                </div>
                <div className="space-y-2">
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
                <CardTitle className="text-base text-indigo-700 font-bold flex items-center gap-2">TradingView Verify++ (Level 2)</CardTitle>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow"><CheckCircle2 className="w-3 h-3 mr-2" /> Verify Match Now</Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Level 1: Data Matching */}
                <div className="p-3 border border-indigo-200 bg-indigo-50/50 rounded flex flex-col gap-2">
                  <span className="text-xs font-bold text-indigo-700 uppercase border-b border-indigo-100 pb-1">Level 1: Indicator Matching</span>
                  <div className="grid grid-cols-4 text-xs font-mono gap-1 text-center">
                    <div className="font-bold text-muted-foreground text-left">Metric</div>
                    <div className="font-bold">TV Value</div>
                    <div className="font-bold">Robot Value</div>
                    <div className="font-bold">Match</div>
                    <div className="col-span-4 border-b my-1"></div>
                    <div className="text-left font-semibold">Close</div><div>112300</div><div>112300</div><div className="text-green-600">YES 🟢</div>
                    <div className="text-left font-semibold text-blue-600">SMA (B3)</div><div>117800</div><div>117800</div><div className="text-green-600">YES 🟢</div>
                  </div>
                </div>
                {/* Level 2: Signal Matching */}
                <div className="p-3 border border-indigo-200 bg-indigo-50/50 rounded flex flex-col gap-2">
                  <span className="text-xs font-bold text-indigo-700 uppercase border-b border-indigo-100 pb-1">Level 2: Signal Matching</span>
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

        {/* TAB: REPLAY DEBUGGER */}
        <TabsContent value="replay" className="animate-in fade-in">
          <Card className="border-purple-500/20 shadow-sm">
            <CardHeader className="bg-purple-500/5 pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2 text-purple-700">
                <History className="w-5 h-5" /> Replay Debugger
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              
              <div className="flex gap-4 mb-6 p-4 border rounded bg-muted/30">
                <div className="space-y-2 flex-1">
                  <Label>Break Point (Stop when...)</Label>
                  <Select defaultValue="long">
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Điều kiện dừng" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long">LONG SIGNAL</SelectItem>
                      <SelectItem value="short">SHORT SIGNAL</SelectItem>
                      <SelectItem value="buy">BUY EXECUTED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white w-32"><Play className="w-4 h-4 mr-2"/> Start Replay</Button>
                </div>
              </div>
              
              <div className="relative border-l-2 border-purple-200 ml-4 md:ml-10 space-y-4 py-2">
                <div className="relative flex items-start">
                  <div className="absolute -left-[9px] w-4 h-4 bg-purple-600 rounded-full mt-1.5"></div>
                  <div className="pl-6 w-full"><div className="p-3 bg-card border rounded text-sm"><span className="font-bold text-purple-700">1. Data:</span> Load Prev/Curr Candle.</div></div>
                </div>
                <div className="relative flex items-start">
                  <div className="absolute -left-[9px] w-4 h-4 bg-purple-600 rounded-full mt-1.5"></div>
                  <div className="pl-6 w-full"><div className="p-3 bg-card border rounded text-sm"><span className="font-bold text-purple-700">2. Strategy:</span> Breakout verified.</div></div>
                </div>
                <div className="relative flex items-start">
                  <div className="absolute -left-[9px] w-4 h-4 bg-background border-4 border-red-500 rounded-full mt-1.5"></div>
                  <div className="pl-6 w-full"><div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm"><span className="font-bold text-red-700">DEBUGGER PAUSED:</span> LONG SIGNAL reached.</div></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
