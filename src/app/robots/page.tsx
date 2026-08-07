import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Play, Square, Settings, Copy, Plus } from "lucide-react"

const robots = [
  {
    id: "r1",
    name: "BTC Swing H3",
    strategy: "BB+MB",
    market: "Binance Futures (BTCUSDT)",
    status: "POSITION_OPEN",
    winRate: "82%",
    pnl: "+$1,520.00",
    lastEvent: "MUA tại 61,200 (1 giờ trước)"
  },
  {
    id: "r2",
    name: "ETH Breakout",
    strategy: "BB+MB",
    market: "Binance Futures (ETHUSDT)",
    status: "WAIT_SIGNAL",
    winRate: "65%",
    pnl: "+$430.00",
    lastEvent: "Đóng lệnh tại 3,200 (3 giờ trước)"
  },
  {
    id: "r3",
    name: "Gold Scalper",
    strategy: "HARSI",
    market: "MT5 Exness (XAUUSD)",
    status: "STOPPED",
    winRate: "70%",
    pnl: "-$120.00",
    lastEvent: "Dừng thủ công bởi Admin"
  }
]

export default function RobotManager() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Quản lý Robot</h2>
          <p className="text-muted-foreground mt-2">
            Tạo mới, cấu hình và giám sát các Robot giao dịch tự động.
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Tạo Robot Mới</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách Robot</CardTitle>
          <CardDescription>Bạn đang có {robots.length} Robot được định cấu hình.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên Robot</TableHead>
                <TableHead>Trạng Thái</TableHead>
                <TableHead>Chiến Lược</TableHead>
                <TableHead>Thị Trường</TableHead>
                <TableHead>Hiệu Suất</TableHead>
                <TableHead>Sự kiện cuối</TableHead>
                <TableHead className="text-right">Hành Động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {robots.map((robot) => (
                <TableRow key={robot.id}>
                  <TableCell className="font-medium">{robot.name}</TableCell>
                  <TableCell>
                    {robot.status === "POSITION_OPEN" && <Badge className="bg-blue-500 hover:bg-blue-600">POSITION_OPEN</Badge>}
                    {robot.status === "WAIT_SIGNAL" && <Badge className="bg-yellow-500 text-yellow-950 hover:bg-yellow-600">WAIT_SIGNAL</Badge>}
                    {robot.status === "STOPPED" && <Badge variant="secondary">STOPPED</Badge>}
                  </TableCell>
                  <TableCell>{robot.strategy}</TableCell>
                  <TableCell>{robot.market}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-green-600">{robot.pnl}</div>
                    <div className="text-xs text-muted-foreground">Win: {robot.winRate}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {robot.lastEvent}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="icon" title="Cấu hình">
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" title="Nhân bản (Clone)">
                        <Copy className="w-4 h-4" />
                      </Button>
                      {robot.status === "STOPPED" ? (
                        <Button variant="default" size="icon" className="bg-green-600 hover:bg-green-700" title="Khởi động">
                          <Play className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button variant="destructive" size="icon" title="Dừng">
                          <Square className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
