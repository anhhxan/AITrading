"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight, CheckCircle2, Rocket } from "lucide-react"
import { useRouter } from "next/navigation"

export default function RobotWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const totalSteps = 6

  const nextStep = () => setStep((s) => Math.min(s + 1, totalSteps))
  const prevStep = () => setStep((s) => Math.max(s - 1, 1))

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-3xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Tạo Robot Mới</h2>
        <p className="text-muted-foreground mt-2">
          Thiết lập Robot giao dịch tự động của bạn qua 6 bước đơn giản.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between w-full mb-4 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted z-0 rounded-full"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary z-0 rounded-full transition-all duration-300" 
          style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
        ></div>
        
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div 
            key={i} 
            className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 bg-background transition-colors
              ${step > i + 1 ? 'border-primary bg-primary text-primary-foreground' : 
                step === i + 1 ? 'border-primary text-primary' : 'border-muted text-muted-foreground'}`}
          >
            {step > i + 1 ? <CheckCircle2 className="w-5 h-5" /> : (i + 1)}
          </div>
        ))}
      </div>

      <Card className="min-h-[400px] flex flex-col">
        <CardHeader>
          <CardTitle>
            {step === 1 && "Bước 1: Tên & Nhận diện"}
            {step === 2 && "Bước 2: Sàn giao dịch & Tài khoản"}
            {step === 3 && "Bước 3: Tài sản & Khung thời gian"}
            {step === 4 && "Bước 4: Chiến lược (Strategy & Indicator)"}
            {step === 5 && "Bước 5: Quản trị Rủi ro (Risk & Exit)"}
            {step === 6 && "Bước 6: Xác nhận & Khởi tạo"}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Đặt tên cho Robot để dễ dàng quản lý sau này."}
            {step === 6 && "Kiểm tra lại toàn bộ thông tin trước khi triển khai."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tên Robot</Label>
                <Input id="name" placeholder="Ví dụ: BTC Swing H3" />
              </div>
            </div>
          )}
          
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-2">
                <Label>Nhà cung cấp (Provider)</Label>
                <Select defaultValue="paper">
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paper">Paper Trading</SelectItem>
                    <SelectItem value="binance">Binance</SelectItem>
                    <SelectItem value="mt5">MT5 Exness</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tài khoản (Account)</Label>
                <Select defaultValue="acc1">
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn Tài khoản" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acc1">Demo Paper 1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-2">
                <Label>Cặp giao dịch (Symbol)</Label>
                <Input placeholder="Ví dụ: BTCUSDT" defaultValue="BTCUSDT" />
              </div>
              <div className="space-y-2">
                <Label>Khung thời gian (Timeframe)</Label>
                <Select defaultValue="3H">
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn Khung thời gian" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15m">15 Minutes</SelectItem>
                    <SelectItem value="1H">1 Hour</SelectItem>
                    <SelectItem value="3H">3 Hours</SelectItem>
                    <SelectItem value="1D">1 Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-2 border-b pb-4">
                <Label className="text-lg">Chiến lược</Label>
                <Select defaultValue="bb_strategy">
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn Chiến lược" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bb_strategy">Breakout & Retracement (BB_Strategy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-4">
                <Label className="text-lg">Chỉ báo (Indicator Params)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Length</Label>
                    <Input type="number" defaultValue={20} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Mult1 (Inner)</Label>
                    <Input type="number" step="0.1" defaultValue={1.0} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Mult2 (Outer)</Label>
                    <Input type="number" step="0.1" defaultValue={2.0} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-4">
                <Label className="text-lg">Rủi ro (Risk %)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Vốn mỗi lệnh (%)</Label>
                    <Input type="number" defaultValue={10} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Đòn bẩy (Leverage)</Label>
                    <Input type="number" defaultValue={10} />
                  </div>
                </div>
              </div>
              <div className="space-y-4 border-t pt-4">
                <Label className="text-lg">Chốt lời & Cắt lỗ (Exit)</Label>
                <Select defaultValue="atr">
                  <SelectTrigger>
                    <SelectValue placeholder="Phương pháp Exit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atr">ATR Trailing Stop</SelectItem>
                    <SelectItem value="fixed">Fixed %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 bg-muted/30 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-muted-foreground">Tên Robot:</div>
                <div className="font-medium">BTC Swing H3</div>
                
                <div className="text-muted-foreground">Provider:</div>
                <div className="font-medium">Paper Trading</div>
                
                <div className="text-muted-foreground">Tài sản:</div>
                <div className="font-medium">BTCUSDT (3H)</div>
                
                <div className="text-muted-foreground">Chiến lược:</div>
                <div className="font-medium">BB_Strategy + BB_MB</div>
                
                <div className="text-muted-foreground">Rủi ro:</div>
                <div className="font-medium">10% Vốn (x10)</div>
              </div>
              <div className="mt-6 p-4 border border-green-500/30 bg-green-500/10 rounded flex items-start gap-3">
                <Rocket className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 dark:text-green-300">
                  Mọi thứ đã sẵn sàng. Robot sẽ được khởi tạo trong trạng thái <strong>CREATED</strong>. Bạn có thể kiểm tra kỹ cấu hình tại trang Robot Detail trước khi nhấn Start.
                </p>
              </div>
            </div>
          )}

        </CardContent>
        <CardFooter className="flex justify-between border-t p-6">
          <Button variant="outline" onClick={prevStep} disabled={step === 1}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
          </Button>
          
          {step < totalSteps ? (
            <Button onClick={nextStep}>
              Tiếp tục <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => router.push('/robots')}>
              Khởi tạo Robot <CheckCircle2 className="w-4 h-4 ml-2" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
