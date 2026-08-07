"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Play, Square, Pause, Copy, Archive, Lock, Activity, ArrowRight, ArrowDown } from "lucide-react"
import TradingViewWidget from "@/components/robots/TradingViewWidget"

export default function RobotDetail() {
  // Mock State để test logic Configuration Lock
  const [robotState, setRobotState] = useState("RUNNING")
  
  // Khóa form khi KHÔNG PHẢI là CREATED hoặc STOPPED
  const isLocked = robotState !== "CREATED" && robotState !== "STOPPED"

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-[1400px] mx-auto">
      
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
            <span className="flex items-center gap-1"><Badge variant="secondary">BB+MB</Badge></span>
            <span>•</span>
            <span>BTCUSDT</span>
            <span>•</span>
            <span>3H</span>
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
          <Button variant="outline" size="sm" title="Clone">
            <Copy className="w-4 h-4 mr-2" /> Clone
          </Button>
          <Button variant="outline" size="sm" title="Archive">
            <Archive className="w-4 h-4 mr-2" /> Archive
          </Button>
        </div>
      </div>

      {/* 2. MAIN TABS */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 lg:grid-cols-10 mb-4 h-auto">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="indicator">Indicator</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="entry">Entry</TabsTrigger>
          <TabsTrigger value="exit">Exit</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="position">Position</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="tv">Chart Preview</TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-muted-foreground">Thông tin chung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between"><span>Version:</span> <span className="font-medium">v1.2.0</span></div>
                <div className="flex justify-between"><span>Provider:</span> <span className="font-medium">Paper Trading</span></div>
                <div className="flex justify-between"><span>Tài khoản:</span> <span className="font-medium">Demo Acc 1</span></div>
                <div className="flex justify-between"><span>Thị trường:</span> <span className="font-medium">BTCUSDT</span></div>
                <div className="flex justify-between"><span>Khung giờ:</span> <span className="font-medium">3H</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-muted-foreground">Kiến trúc (Plugins)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between"><span>Indicator:</span> <span className="font-medium">BB_MB</span></div>
                <div className="flex justify-between"><span>Strategy:</span> <span className="font-medium">BB_Strategy</span></div>
                <div className="flex justify-between"><span>Entry:</span> <span className="font-medium">Market_Entry</span></div>
                <div className="flex justify-between"><span>Exit:</span> <span className="font-medium">ATR_Trailing</span></div>
                <div className="flex justify-between"><span>Risk:</span> <span className="font-medium">Fixed_Risk</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-muted-foreground">Trạng thái & Lịch sử</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between"><span>Trạng thái:</span> <span className="font-medium text-green-500">POSITION_OPEN</span></div>
                <div className="flex justify-between"><span>Lần cuối đổi state:</span> <span className="font-medium">10 phút trước</span></div>
                <div className="flex justify-between"><span>Ngày tạo:</span> <span className="font-medium text-muted-foreground">2026-08-01</span></div>
                <div className="flex justify-between"><span>Cập nhật cấu hình:</span> <span className="font-medium text-muted-foreground">2026-08-05</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: INDICATOR */}
        <TabsContent value="indicator" className="animate-in fade-in">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cấu hình Indicator: BB_MB</CardTitle>
                  <CardDescription>Tham số tính toán Bollinger Bands và Moving Average.</CardDescription>
                </div>
                {isLocked && (
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                    <Lock className="w-3 h-3 mr-1" /> Configuration Locked (Robot is {robotState})
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Thông số thị trường hiện tại (Tham chiếu)</h4>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm text-center">
                  <div className="p-3 bg-muted rounded-md border"><div className="text-muted-foreground text-xs">Band 1</div><div className="font-bold">65,200</div></div>
                  <div className="p-3 bg-muted rounded-md border"><div className="text-muted-foreground text-xs">Band 2</div><div className="font-bold">64,100</div></div>
                  <div className="p-3 bg-muted rounded-md border border-blue-500/30"><div className="text-blue-500 text-xs">Basis (EMA)</div><div className="font-bold">63,000</div></div>
                  <div className="p-3 bg-muted rounded-md border"><div className="text-muted-foreground text-xs">Band 4</div><div className="font-bold">61,900</div></div>
                  <div className="p-3 bg-muted rounded-md border"><div className="text-muted-foreground text-xs">Band 5</div><div className="font-bold">60,800</div></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 8: TIMELINE */}
        <TabsContent value="timeline" className="animate-in fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Timeline Workflow</CardTitle>
              <CardDescription>Luồng sự kiện (Event Lifecycle) trực quan từ bảng robot_events.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative border-l-2 border-muted ml-4 md:ml-10 space-y-8 py-4">
                
                <div className="relative flex items-center">
                  <div className="absolute -left-[9px] w-4 h-4 bg-background border-2 border-green-500 rounded-full flex items-center justify-center">
                  </div>
                  <div className="pl-6 w-full max-w-lg">
                    <div className="p-3 bg-card border rounded-lg shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <Badge variant="outline" className="text-green-500 bg-green-500/10">WAIT_SIGNAL</Badge>
                        <span className="text-xs text-muted-foreground">08:00 AM</span>
                      </div>
                      <p className="text-sm">Robot khởi động, bắt đầu lắng nghe tín hiệu.</p>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <div className="absolute -left-[9px] w-4 h-4 bg-background border-2 border-yellow-500 rounded-full flex items-center justify-center">
                  </div>
                  <div className="pl-6 w-full max-w-lg">
                    <div className="p-3 bg-card border rounded-lg shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <Badge variant="outline" className="text-yellow-600 bg-yellow-500/10">LONG SIGNAL</Badge>
                        <span className="text-xs text-muted-foreground">11:00 AM</span>
                      </div>
                      <p className="text-sm">Giá phá vỡ Band 4 đi lên. Chờ giá hồi (Retracement).</p>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <div className="absolute -left-[9px] w-4 h-4 bg-background border-2 border-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>
                  </div>
                  <div className="pl-6 w-full max-w-lg">
                    <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <Badge variant="outline" className="text-blue-500 bg-blue-500/10">WAIT_RETRACEMENT</Badge>
                        <span className="text-xs text-muted-foreground">14:00 PM (Current)</span>
                      </div>
                      <p className="text-sm">Đang chờ giá điều chỉnh vào vùng 20% biên độ.</p>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center opacity-50">
                  <div className="absolute -left-[9px] w-4 h-4 bg-background border-2 border-muted-foreground rounded-full flex items-center justify-center">
                  </div>
                  <div className="pl-6 w-full max-w-lg">
                    <div className="p-3 border border-dashed rounded-lg">
                      <Badge variant="outline" className="text-muted-foreground mb-1">BUY (Pending)</Badge>
                      <p className="text-sm text-muted-foreground">Sẵn sàng vào lệnh.</p>
                    </div>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 10: TRADINGVIEW */}
        <TabsContent value="tv" className="animate-in fade-in h-[600px]">
          <Card className="h-full flex flex-col">
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">TradingView Reference</CardTitle>
                <Badge variant="secondary">BTCUSDT • 3H</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
               <TradingViewWidget />
            </CardContent>
          </Card>
        </TabsContent>

        {/* (Các tab khác sẽ được phát triển tiếp) */}
        
      </Tabs>
    </div>
  )
}
