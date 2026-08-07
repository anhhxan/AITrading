"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Square, Pause, Copy, Archive, Lock, Beaker, CheckCircle2, AlertTriangle, Download, Search, Server, Activity, Database, History, Braces } from "lucide-react"
import TradingViewWidget from "@/components/robots/TradingViewWidget"

export default function RobotDetail() {
  const [robotState, setRobotState] = useState("RUNNING")
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
              <span className="flex items-center gap-1"><Badge variant="secondary">Strategy Exit v1</Badge></span>
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
            
            <Button variant="outline" size="sm" title="Clone">
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" title="Archive">
              <Archive className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Monitors (Market Data & Runtime) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Market Data Monitor */}
          <Card className="border-blue-500/20 bg-blue-500/5 shadow-sm">
            <CardHeader className="py-3 px-4 border-b bg-background/50">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                <Database className="w-4 h-4" /> Market Data Monitor
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3 px-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div><span className="text-muted-foreground block mb-1">Provider</span><span className="font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500"/> Binance Futures</span></div>
                <div><span className="text-muted-foreground block mb-1">WebSocket</span><span className="font-bold flex items-center gap-1 text-green-600">Connected</span></div>
                <div><span className="text-muted-foreground block mb-1">Latency</span><span className="font-mono">48 ms</span></div>
                <div><span className="text-muted-foreground block mb-1">Data Delay</span><span className="font-mono text-green-600">0.0 sec</span></div>
                <div><span className="text-muted-foreground block mb-1">Symbol</span><span className="font-bold">BTCUSDT</span></div>
                <div><span className="text-muted-foreground block mb-1">Timeframe</span><span className="font-bold">3H</span></div>
                <div className="col-span-2"><span className="text-muted-foreground block mb-1">Last Update</span><span className="font-mono">14:59:59 (Current Candle)</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Robot Runtime Monitor */}
          <Card className="border-green-500/20 bg-green-500/5 shadow-sm">
            <CardHeader className="py-3 px-4 border-b bg-background/50">
              <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                <Server className="w-4 h-4" /> Robot Runtime Monitor
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3 px-4">
              <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-xs">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="font-semibold">Indicator Engine</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="font-semibold">Strategy Engine</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="font-semibold">State Machine</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="font-semibold">Risk Engine</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="font-semibold">Notification</span></div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-400"></span><span className="font-semibold text-muted-foreground">Execution (Idle)</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 2. MAIN TABS */}
      <Tabs defaultValue="decision" className="w-full">
        <TabsList className="flex flex-wrap w-full mb-4 h-auto justify-start gap-1">
          <TabsTrigger value="decision" className="font-bold text-blue-600">🧠 Decision</TabsTrigger>
          <TabsTrigger value="inspector" className="font-bold text-teal-600">🔍 Candle Inspector</TabsTrigger>
          <TabsTrigger value="context" className="font-bold text-orange-600">JSON Context</TabsTrigger>
          <TabsTrigger value="indicator">Indicator</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="exit">Exit</TabsTrigger>
          <TabsTrigger value="tv" className="font-bold text-indigo-600">TradingView Verify</TabsTrigger>
          <TabsTrigger value="replay" className="font-bold text-purple-600">Replay Debugger</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
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
                      <span className="font-mono text-xs">Between Band4 & Band5</span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                      <span>Status:</span>
                      <Badge variant="outline" className="text-green-500 border-green-500">PASS</Badge>
                    </div>
                    
                    <p className="text-muted-foreground font-semibold mt-4">Current Candle</p>
                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                      <span>Condition:</span>
                      <span className="font-mono text-xs">Close &gt; Band4</span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                      <span>Status:</span>
                      <Badge variant="outline" className="text-green-500 border-green-500">PASS</Badge>
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
                    <div className="p-2 border rounded bg-green-500/10 text-green-700 font-semibold mb-2 flex justify-between">
                      <span>Risk</span><span>PASS</span>
                    </div>
                    <div className="p-2 border rounded bg-green-500/10 text-green-700 font-semibold mb-2 flex justify-between">
                      <span>Margin</span><span>PASS</span>
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
                <Search className="w-5 h-5" />
                Candle Inspector
              </CardTitle>
              <CardDescription>Công cụ soi siêu chi tiết dữ liệu (OHLCV, Indicator) tại cây nến hiện tại.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <div className="space-y-3">
                <h4 className="font-bold text-sm border-b pb-2 text-teal-700">Current Candle</h4>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground">Time</span><span>2026-08-07 15:00</span></div>
                  <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground">Open</span><span>117,000</span></div>
                  <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground text-green-600">High</span><span className="text-green-600">118,200</span></div>
                  <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground text-red-600">Low</span><span className="text-red-600">116,900</span></div>
                  <div className="flex justify-between border-b pb-1 font-bold"><span className="text-teal-600">Close</span><span>118,100</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Volume</span><span>220 BTC</span></div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-sm border-b pb-2 text-blue-700">Indicator Result</h4>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground">Band 1</span><span>119,500</span></div>
                  <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground">Band 2</span><span>118,900</span></div>
                  <div className="flex justify-between border-b pb-1 font-bold text-blue-600"><span>Band 3 (SMA)</span><span>117,800</span></div>
                  <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground">Band 4</span><span>116,700</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Band 5</span><span>116,000</span></div>
                </div>
              </div>

              <div className="col-span-2 space-y-3">
                <h4 className="font-bold text-sm border-b pb-2 text-orange-700">State Machine & Decision</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 border rounded bg-card space-y-2">
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">State Machine</span><Badge className="bg-yellow-500">WAIT_RETRACE</Badge></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Current Timeout</span><span className="font-mono font-bold">1 / 3</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Entry Zone</span><span className="font-mono text-blue-600">116k - 116.14k</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Inside Zone</span><Badge variant="outline" className="text-green-500 border-green-500">YES</Badge></div>
                  </div>
                  <div className="p-3 border rounded bg-card flex flex-col justify-center items-center gap-2">
                    <span className="text-muted-foreground">Robot Decision</span>
                    <span className="font-bold text-2xl text-green-600">LONG</span>
                  </div>
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
                <Braces className="w-5 h-5" />
                Robot Context Viewer
              </CardTitle>
              <CardDescription>Hiển thị JSON Object Context toàn vẹn (Single Source of Truth) đang chảy trong Core Engine.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <pre className="p-4 rounded-md bg-zinc-950 text-green-400 font-mono text-xs overflow-auto h-[400px]">
{`{
  "id": "BTC_Swing_H3",
  "symbol": "BTCUSDT",
  "timeframe": "3H",
  "provider": {
    "marketData": "binance_futures",
    "execution": "paper"
  },
  "config": {
    "indicator": {
      "id": "BB_MB",
      "version": "1.0.0",
      "params": { "length": 20, "mult": 2, "mult2": 1 }
    },
    "strategy": {
      "id": "BB_Strategy_Breakout",
      "version": "1.0.0"
    }
  },
  "state": {
    "current": "WAIT_RETRACE",
    "timeout": 1,
    "entryZone": [112000, 112180],
    "lastSignal": "LONG"
  }
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: TRADINGVIEW VERIFY++ */}
        <TabsContent value="tv" className="animate-in fade-in h-[850px]">
          <Card className="h-full flex flex-col border-indigo-500/20 shadow-sm">
            <CardHeader className="py-3 px-4 border-b bg-indigo-500/5">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base text-indigo-700 font-bold flex items-center gap-2">
                      TradingView Verify++
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 text-red-600 font-semibold">
                      Golden Rule #3: Core Engine KHÔNG đọc trực tiếp từ TradingView. Mọi quyết định đều từ Market Data Provider. Bảng này chỉ dùng để so sánh (Verify).
                    </p>
                  </div>
                  <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow">
                    <CheckCircle2 className="w-3 h-3 mr-2" /> Verify Match Now
                  </Button>
                </div>
                
                {/* Verify Table */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                  <div className="col-span-4 lg:col-span-1 p-3 border rounded bg-card flex flex-col gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase border-b pb-1">TV Config</span>
                    <span className="font-mono text-sm">BINANCE:BTCUSDT.P</span>
                    <span className="font-mono text-sm">Basis: SMA, Source: Close</span>
                    <span className="font-mono text-sm">Len: 20, Mult: 2/1</span>
                  </div>
                  
                  <div className="col-span-4 lg:col-span-3 p-3 border border-indigo-200 bg-indigo-50/50 rounded flex flex-col gap-2">
                    <span className="text-xs font-bold text-indigo-700 uppercase border-b border-indigo-100 pb-1">Data Matching (Current Candle)</span>
                    <div className="grid grid-cols-6 text-xs text-center font-mono gap-1">
                      <div className="font-bold text-muted-foreground text-left">Metric</div>
                      <div className="font-bold text-indigo-700">TV Value</div>
                      <div className="font-bold text-green-700">Robot Value</div>
                      <div className="font-bold">Diff</div>
                      <div className="font-bold">Match</div>
                      
                      <div className="col-span-6 border-b my-1"></div>
                      
                      <div className="text-left font-semibold">Close</div>
                      <div>112300</div><div>112300</div><div>0.00%</div><div className="text-green-600">YES 🟢</div>
                      
                      <div className="text-left font-semibold">Band 1</div>
                      <div>119500</div><div>119500</div><div>0.00%</div><div className="text-green-600">YES 🟢</div>
                      
                      <div className="text-left font-semibold">Band 2</div>
                      <div>118900</div><div>118900</div><div>0.00%</div><div className="text-green-600">YES 🟢</div>
                      
                      <div className="text-left font-semibold text-blue-600">SMA (B3)</div>
                      <div>117800</div><div>117800</div><div>0.00%</div><div className="text-green-600">YES 🟢</div>
                      
                      <div className="text-left font-semibold">Band 4</div>
                      <div>116700</div><div>116700</div><div>0.00%</div><div className="text-green-600">YES 🟢</div>
                      
                      <div className="text-left font-semibold">Band 5</div>
                      <div>116000</div><div>116000</div><div>0.00%</div><div className="text-green-600">YES 🟢</div>
                    </div>
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
                <History className="w-5 h-5" />
                Replay Debugger
              </CardTitle>
              <CardDescription>
                Golden Rule #4: Every trading decision must be reproducible. Chạy lại logic của một cây nến bất kỳ trong lịch sử để xác minh luồng quyết định (Step-by-step trace).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex gap-4 mb-6 p-4 border rounded bg-muted/30">
                <div className="space-y-2 flex-1">
                  <Label>Từ khoảng thời gian (From)</Label>
                  <Input type="datetime-local" defaultValue="2025-01-01T00:00" />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Đến khoảng thời gian (To)</Label>
                  <Input type="datetime-local" defaultValue="2026-01-01T00:00" />
                </div>
                <div className="flex items-end">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white w-32"><Play className="w-4 h-4 mr-2"/> Start Replay</Button>
                </div>
              </div>
              
              <div className="relative border-l-2 border-purple-200 ml-4 md:ml-10 space-y-6 py-4">
                <div className="relative flex items-start">
                  <div className="absolute -left-[9px] w-4 h-4 bg-purple-600 rounded-full mt-1.5"></div>
                  <div className="pl-6 w-full max-w-3xl">
                    <div className="p-3 bg-card border rounded shadow-sm text-sm">
                      <span className="font-bold text-purple-700">1. Data Ingestion:</span> Load Previous Candle + Current Candle from Market Data Source.
                    </div>
                  </div>
                </div>
                <div className="relative flex items-start">
                  <div className="absolute -left-[9px] w-4 h-4 bg-purple-600 rounded-full mt-1.5"></div>
                  <div className="pl-6 w-full max-w-3xl">
                    <div className="p-3 bg-card border rounded shadow-sm text-sm">
                      <span className="font-bold text-purple-700">2. Indicator:</span> Computed BB_MB v1.0.0 (Deterministic). Band 4 = 116700.
                    </div>
                  </div>
                </div>
                <div className="relative flex items-start">
                  <div className="absolute -left-[9px] w-4 h-4 bg-purple-600 rounded-full mt-1.5"></div>
                  <div className="pl-6 w-full max-w-3xl">
                    <div className="p-3 bg-card border rounded shadow-sm text-sm">
                      <span className="font-bold text-purple-700">3. Strategy:</span> Breakout verified on Previous Candle. Retracement triggered on Current Candle.
                    </div>
                  </div>
                </div>
                <div className="relative flex items-start">
                  <div className="absolute -left-[9px] w-4 h-4 bg-purple-600 rounded-full mt-1.5"></div>
                  <div className="pl-6 w-full max-w-3xl">
                    <div className="p-3 bg-card border rounded shadow-sm text-sm">
                      <span className="font-bold text-purple-700">4. Signal emitted:</span> <Badge className="bg-yellow-500 ml-2">LONG SIGNAL</Badge>
                    </div>
                  </div>
                </div>
                <div className="relative flex items-start">
                  <div className="absolute -left-[9px] w-4 h-4 bg-purple-600 rounded-full mt-1.5"></div>
                  <div className="pl-6 w-full max-w-3xl">
                    <div className="p-3 bg-card border rounded shadow-sm text-sm">
                      <span className="font-bold text-purple-700">5. Risk Engine:</span> Evaluated 2% balance. Sufficient Margin.
                    </div>
                  </div>
                </div>
                <div className="relative flex items-start">
                  <div className="absolute -left-[9px] w-4 h-4 bg-background border-4 border-green-500 rounded-full mt-1.5"></div>
                  <div className="pl-6 w-full max-w-3xl">
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded shadow-sm text-sm">
                      <span className="font-bold text-green-700 text-base">6. Execution:</span> <span className="font-bold">BUY 0.1 BTC at 116120</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
