# PHASE 1 EVENT PROCESSING ARCHITECTURE DECISION INVESTIGATION

## 1. Khi EventBus xử lý CANDLE_CLOSED_EVENT: handler có await toàn bộ IndicatorEngine.handleCandleClosed() không?
**Có.** 
Trong `EventBus.processQueue`, vòng lặp xử lý gọi `await handler(event);`.
Do đó, EventBus thực sự sẽ chờ hàm `IndicatorEngine.handleCandleClosed()` chạy xong rồi mới lặp sang event tiếp theo trong queue.

## 2. IndicatorEngine.handleCandleClosed(): khi publish INDICATOR_UPDATED_EVENT, nó có await việc xử lý downstream hay chỉ enqueue?
**Chỉ enqueue.**
Mặc dù code ghi là `await coreEventBus.publish(nextEvent)`, nhưng bản chất bên trong hàm `publish` hiện tại không hề await việc xử lý.

## 3. EventBus.publish(): Promise trả về hoàn thành khi nào?
**A. Khi Event được đưa vào queue.**
Bên trong `publish`:
```typescript
this.queues.get(robotId)!.push(event);
this.processQueue(robotId); // Thiếu chữ 'await', fire-and-forget
return; // Promise resolve ngay lập tức
```
Do đó, `publish` hoàn thành ngay khi nhét event vào cuối hàng đợi.

## 4. Nếu thay đổi semantics của publish/processQueue để await publish(INTERNAL) hoàn thành, có tạo deadlock/recursive queue không?
**Có Deadlock Logic (nhưng không treo Node.js nhờ cơ chế Lock hiện hành).**
Nếu ta sửa thành `await this.processQueue(robotId)` bên trong `publish`:
- Khi CANDLE 20 đang chạy, biến `this.processing.get(robotId)` đang là `true`.
- `IndicatorEngine` gọi `await publish(INDICATOR 20)`.
- `publish` gọi tiếp `await this.processQueue(robotId)`.
- Hàm `processQueue` thứ 2 phát hiện `this.processing === true`, lập tức `return` (không làm gì cả).
- Kết quả: `publish` trả về ngay lập tức, INDICATOR 20 bị ném xuống CUỐI queue.
- Nếu Queue đang có sẵn [CANDLE 21, CANDLE 22], thì Queue sẽ thành: `[CANDLE 21, CANDLE 22, INDICATOR 20]`.
=> Hậu quả: Vòng lặp ngoài sẽ lôi CANDLE 21 ra chạy TRƯỚC KHI xử lý INDICATOR 20. Vi phạm hoàn toàn Causal Ordering!

## 5. Có thể duy trì một FIFO queue duy nhất và xử lý causal chain mà KHÔNG cần thêm công nghệ mới?
**CÓ THỂ.** Và đây là cốt lõi của giải pháp.
Chúng ta có thể xử lý triệt để bài toán này bằng cách biến **Queue thành Stack một phần đối với Internal Events (Causal Events)**, đồng thời tái định nghĩa ý nghĩa của `sequence`.

**Giải pháp đề xuất (Chỉ sửa logic Queue):**
- Mọi event thuộc cùng một Pipeline (Candle 20 -> Indicator 20 -> Strategy 20) SẼ DÙNG CHUNG CÙNG MỘT `sequence = 20`.
- Trong `EventBus.publish`:
  - `EventBus` nhận biết một event là "Internal/Downstream" nếu sequence của nó BẰNG với sequence đang được xử lý (ví dụ EventBus đang xử lý Candle 20, nhận được một event mới cũng có seq=20).
  - Đối với các Internal Event này, EventBus sẽ **đẩy lên ĐẦU hàng đợi (unshift)** thay vì cuối hàng đợi (push).
  - Đồng thời, bỏ qua logic chặn out-of-order `seq < expected` nếu nó là Internal Event (cùng seq).
- Kết quả Queue (khi đang xử lý Candle 20 và có sẵn Candle 21 ở dưới):
  1. Xử lý CANDLE 20.
  2. IndicatorEngine emit INDICATOR 20.
  3. Nhận thấy INDICATOR 20 cùng sequence với event hiện tại (20). Push lên đầu Queue.
  4. Queue hiện tại: `[INDICATOR 20, CANDLE 21]`.
  5. Vòng lặp `while` hiện tại tiếp tục, bốc sự kiện trên cùng -> INDICATOR 20 được chạy ngay lập tức!
  6. Tương tự, nếu STRATEGY 20 được sinh ra, nó lại được push lên đầu Queue, đè lên CANDLE 21.
  7. Sau khi toàn bộ nhánh 20 chạy xong, vòng lặp mới tới CANDLE 21.

## 6. Sửa đổi tối thiểu về code (KHÔNG thay đổi kiến trúc/DB/Contract)
- **Trong `IndicatorEngine.ts`**: Bỏ `sequence + 1`, sử dụng đúng `event.trace.sequence`. (Indicator 20 sẽ có `sequence = 20`).
- **Trong `EventBus.ts`**:
  - Lưu lại `currentProcessingSequence` cho mỗi Robot.
  - Khi nhận sự kiện: Nếu `event.sequence === currentProcessingSequence`, thì dùng `unshift()` (nhét lên đầu) thay vì `push()`.
  - Khắc phục cơ chế `expectedSequence`: Chỉ tăng `expectedSequence` khi gặp event có sequence LỚN HƠN. Những Internal Event có sequence BẰNG với event hiện tại sẽ không bị chối bỏ.

## 7. Quan trọng: `trace.sequence` phải đại diện cho cái gì sau khi sửa?
- `trace.sequence`: BẮT BUỘC ĐẠI DIỆN CHO **CANDLE/PIPELINE SEQUENCE**. Toàn bộ sinh mệnh của một cây nhân quả khởi nguồn từ Candle N đều dùng chung `sequence = N`. Nó định hình thứ tự thời gian của thị trường.
- `eventId`: Đại diện cho **định danh duy nhất** của từng bước nhỏ trong Pipeline (như một giọt nước trong dòng sông).
- `parentId`: Trỏ về giọt nước ngay trước đó (Indicator trỏ về Candle).
- `correlationId`: Đại diện cho toàn bộ dòng sông (Một luồng chạy).

## 8. Trace hoàn chỉnh (Chứng minh #21 không lọt lên trước #20)
**Thời điểm 0**:
Queue = `[CANDLE 20, CANDLE 21]`

**Thời điểm 1**:
- Worker lôi CANDLE 20 ra chạy.
- Cập nhật `currentProcessingSequence = 20`.
- IndicatorEngine nhận CANDLE 20 -> Emit INDICATOR 20 (seq=20).
- `publish(INDICATOR 20)` thấy `seq == 20`, liền **unshift** lên đầu.
- Queue = `[INDICATOR 20, CANDLE 21]`

**Thời điểm 2**:
- Worker lôi INDICATOR 20 ra chạy.
- StrategyEngine nhận INDICATOR 20 -> Emit STRATEGY 20 (seq=20).
- `publish(STRATEGY 20)` thấy `seq == 20`, **unshift** lên đầu.
- Queue = `[STRATEGY 20, CANDLE 21]`

**Thời điểm 3**:
- Worker lôi STRATEGY 20 ra chạy.
- StateEngine nhận STRATEGY 20 -> Xong Pipeline 20. Không emit gì thêm.
- Queue = `[CANDLE 21]`

**Thời điểm 4**:
- Worker lôi CANDLE 21 ra chạy, cập nhật `currentProcessingSequence = 21`...
- Quy trình lặp lại, không có cơ hội nào cho CANDLE 21 chạy trước khi chuỗi của 20 dứt điểm.

## 9. Chạy bằng reasoning: Mô phỏng publish 100 CANDLE liên tục
- Vòng lặp 100 lần publish chớp nhoáng: Toàn bộ 100 nến được tống vào đuôi queue: `[CANDLE 1, CANDLE 2... CANDLE 100]`.
- Worker khởi động, lấy CANDLE 1 ra.
- Nếu sinh ra Event phái sinh, các event này được nhét lên đầu Queue `[INTERNAL 1, CANDLE 2... CANDLE 100]`.
- Worker cứ tước dần phần đỉnh của Queue cho đến khi hết sạch chuỗi số 1, thì mới chạm tới CANDLE 2.
- **Kết quả**: Causal Pipeline được đảm bảo nguyên vẹn 100% bằng ĐÚNG một FIFO/Stack hybrid queue duy nhất, không deadlock, không Message Broker.
