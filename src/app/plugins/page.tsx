"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, XCircle, Box, AlertTriangle, ShieldCheck } from "lucide-react"

export default function PluginManager() {
  const plugins = [
    {
      id: "BB_MB",
      type: "Indicator",
      version: "v1.0.0",
      pineVersion: "v4 Standard",
      status: "Installed",
      verified: true,
      hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      isDeterministic: true
    },
    {
      id: "HARSI",
      type: "Indicator",
      version: "-",
      pineVersion: "v5",
      status: "Not Installed",
      verified: false,
      hash: "-",
      isDeterministic: false
    },
    {
      id: "BB_Strategy_Breakout",
      type: "Strategy",
      version: "v1.0.0",
      pineVersion: "N/A",
      status: "Installed",
      verified: true,
      hash: "8a9b4c4298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b866",
      isDeterministic: true
    },
    {
      id: "ATR_Trailing_Exit",
      type: "Exit",
      version: "v2.1.0",
      pineVersion: "v5 Standard",
      status: "Installed",
      verified: true,
      hash: "f4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149a",
      isDeterministic: true
    }
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-[1400px] mx-auto">
      
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Box className="w-8 h-8 text-blue-600" />
          Plugin Manager
        </h2>
        <p className="text-muted-foreground">Quản lý vòng đời, phiên bản và tính toàn vẹn (Integrity) của toàn bộ hệ sinh thái Plugin.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardHeader className="py-4">
            <CardTitle className="text-blue-700 text-lg">Installed Plugins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">3</div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="py-4">
            <CardTitle className="text-green-700 text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Verified & Deterministic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">3</div>
            <p className="text-xs text-green-600 mt-1">100% Reprodicible</p>
          </CardContent>
        </Card>

        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardHeader className="py-4">
            <CardTitle className="text-orange-700 text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Updates Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700">0</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plugin Registry</CardTitle>
          <CardDescription>
            Golden Rule #5: Mọi Plugin phải có tính xác định (Deterministic). Nếu không đạt, sẽ bị từ chối chạy trên Live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plugin Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Pine Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>SHA256 Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plugins.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold">{p.id}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{p.version}</TableCell>
                  <TableCell className="text-sm">{p.pineVersion}</TableCell>
                  <TableCell>
                    {p.status === "Installed" ? (
                      <Badge className="bg-blue-500 hover:bg-blue-600">Installed</Badge>
                    ) : (
                      <Badge variant="secondary">Not Installed</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.verified ? (
                      <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Verified
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground text-sm">
                        <XCircle className="w-4 h-4" /> Unverified
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.hash !== "-" ? (
                      <span className="font-mono text-xs text-muted-foreground" title={p.hash}>
                        {p.hash.substring(0, 16)}...
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
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
