# PHASE 1 & 2 SEQUENCE ARCHITECTURE INVESTIGATION

## 1. Hiện tại trace.sequence được sinh ở đâu?
- Đối với `CANDLE_CLOSED_EVENT`: Được sinh từ bên ngoài (trong test script là vòng lặp for, trong thực tế là từ `MarketDataEngine` khi có nến mới).
- Đối với `INDICATOR_UPDATED_EVENT`: Được sinh bên trong `IndicatorEngine.ts` khi nó nhận được nến.

## 2. EventFactory tạo sequence như thế nào?
- `EventFactory.createTrace()` **không** tự động sinh hay tăng sequence. Nó chỉ nhận tham số `sequence: number` truyền vào từ bên ngoài và gắn trực tiếp vào object `DecisionTrace`.

## 3. CANDLE_CLOSED_EVENT sequence được tạo như thế nào?
- Tạo độc lập và tăng dần theo từng nến (ví dụ nến 1 seq=1, nến 2 seq=2... nến 100 seq=100).

## 4. INDICATOR_UPDATED_EVENT sequence được tạo như thế nào?
- Trong `IndicatorEngine.ts`, hàm `handleCandleClosed` lấy sequence của CANDLE_CLOSED_EVENT hiện tại và cộng thêm 1:
  `sequence: event.trace.sequence + 1`

## 5. Downstream Event có giữ sequence của source Event hay tự tạo sequence mới?
- Hiện tại, Downstream Event **không giữ** nguyên sequence của Source Event mà **tự tạo sequence mới** bằng cách tịnh tiến `+1`.

## 6. parentId/correlationId hiện tại liên kết CANDLE -> INDICATOR như thế nào?
- Liên kết Causal (nhân - quả) đang hoạt động rất tốt:
  - `correlationId` của Candle được giữ nguyên, truyền tiếp sang Indicator.
  - `eventId` của Candle được gán thành `parentId` của Indicator.
  - => Hệ thống hoàn toàn có thể vẽ lại được Cây Phả Hệ: Candle 20 sinh ra Indicator 20.

## 7. EventBus expectedSequences hiện đang có ý nghĩa gì?
- `EventBus` lưu trữ một biến `expectedSequences` duy nhất cho mỗi `robotId`.
- Nó có ý nghĩa: "Sự kiện tiếp theo đến với Robot này BẮT BUỘC phải mang sequence lớn hơn đúng 1 đơn vị so với sự kiện trước đó, BẤT KỂ ĐÓ LÀ LOẠI SỰ KIỆN GÌ". 
- Nếu nhận sequence nhỏ hơn, nó coi là Event cũ (Stale) và **vứt bỏ (Drop)**.

## 8. EventBus có đang đảm bảo: CANDLE #20 -> toàn bộ pipeline -> CANDLE #21 hay chỉ đảm bảo FIFO của từng event?
- **KHÔNG**. `EventBus` hiện tại **chỉ đảm bảo FIFO của từng event được đẩy vào queue**. 
- Hàm `processQueue` chạy bất đồng bộ (fire-and-forget), nên nếu 100 Candle được đẩy vào liên tục, EventBus sẽ nhận đủ 100 Candle vào queue mà KHÔNG HỀ chặn Candle 21 đợi Indicator 20 hoàn thành.

## 9. Trace chính xác khi publish 100 CANDLE liên tục:
1. Script đẩy chớp nhoáng 100 nến vào `EventBus`.
2. `EventBus` nhận nến 1 (seq=1) đến nến 100 (seq=100).
3. Do nhận đủ 100 nến (đúng FIFO), `expectedSequences` của Robot bị đẩy lên mức **101**.
4. Background Worker `processQueue` bắt đầu xử lý nến 1... 19 (Plugin NOT READY, không emit gì).
5. Xử lý nến 20: Plugin READY. `IndicatorEngine` tạo `INDICATOR_UPDATED_EVENT` với `sequence = 20 + 1 = 21`.
6. `IndicatorEngine` gọi `EventBus.publish(INDICATOR_UPDATED_EVENT, seq=21)`.
7. `EventBus` kiểm tra: `seq(21) < expected(101)`.
8. `EventBus` kết luận đây là sự kiện Stale/Trùng lặp -> **DROP**.
9. Kịch bản này lặp lại với nến 21 đến 99 (đều emit sequence < 101 và bị drop).
10. Nến 100 emit `seq=101`. Lần này `seq(101) === expected(101)` -> Sự kiện duy nhất lọt qua và được emit!

## 10. Xác định chính xác vì sao 80 INDICATOR_UPDATED_EVENT bị drop.
- Do tốc độ publish của vòng lặp nhanh hơn tốc độ xử lý của engine, khiến bộ đếm `expectedSequence` toàn cục của `EventBus` chạm nóc 101 trước khi các Downstream Event kịp sinh ra. Các Downstream Event khi sinh ra mang sequence cũ (21...100) bị EventBus coi là rác và từ chối.

---

## A. Bản chất thực sự của `sequence` hiện tại
Nó đang bị sử dụng sai mục đích (lẫn lộn cả 3 khái niệm):
1. Bên ngoài (MarketData / Test Script) dùng nó như **Candle Sequence**.
2. Bên trong (`EventBus`) lại dùng nó như **Global Event Sequence** (chặn bắt mọi loại event).
3. Các Engine (`IndicatorEngine`) lại dùng nó như **Pipeline Step** (`+1` để phân tầng).

## B. Đổi EventBus thành `expectedSequences[robotId + eventType]` có đảm bảo Causal Ordering không?
**KHÔNG.**
Nếu tách ra, các event sẽ không còn dẫm chân lên nhau và lỗi Drop sẽ hết. NHƯNG nó sẽ biến hệ thống thành các dòng chảy hoàn toàn độc lập. Candle 21 sẽ chạy thẳng một mạch qua `IndicatorEngine` mà không cần biết Strategy của Candle 20 đã xử lý xong chưa. Điều khoản *"Candle N phải xong toàn bộ pipeline mới tới N+1"* sẽ bị phá vỡ hoàn toàn. 

## C. Đề xuất phương án sửa NHỎ NHẤT (Kiến trúc chuẩn)
**Lựa chọn: PHƯƠNG ÁN A (Sequence là Pipeline/Candle Sequence)**

1. **Ý tưởng cốt lõi**: Mọi Event được sinh ra từ cùng một Nến sẽ chia sẻ **CÙNG MỘT SEQUENCE**. 
   - `CANDLE_CLOSED` (seq=20) -> `INDICATOR_UPDATED` (seq=20) -> `STRATEGY_SIGNAL` (seq=20).
   - Việc truy vết nhân - quả đã có `correlationId` và `parentId` lo. Việc truy vết thứ tự thời gian đã có `timestamp`.

2. **Sửa đổi Tối thiểu (Minh bạch & An toàn)**:
   - Sửa 1 dòng trong `IndicatorEngine.ts` (Phase 2): `sequence: event.trace.sequence` (Thay vì `+ 1`).
   - Sửa logic kiểm tra Sequence của `EventBus.ts` (Phase 1):
     `EventBus` CHỈ áp dụng chốt chặn `expectedSequence` đối với sự kiện khởi nguồn của Pipeline (External Events như `CANDLE_CLOSED_EVENT`). Đối với các sự kiện nội bộ sinh ra từ Engine (`INDICATOR_UPDATED_EVENT`, v.v...), `EventBus` bỏ qua chốt chặn FIFO Sequence này và cho đẩy thẳng vào Queue. (Bởi vì chúng được sinh ra theo đúng trật tự từ chính Engine bên trong, nên tự bản thân chúng đã có tính tuần tự, không sợ rác từ mạng).

3. **Chặn Pipeline (Candle N -> Candle N+1)**:
   - Để ngăn Candle 21 chạy chồng lên Candle 20, chúng ta cần một cơ chế Lock hoặc Semaphore. 
   - Không đưa Lock vào `EventBus` (nó chỉ là cái ống nước). 
   - Sẽ giao cho `MarketDataEngine` hoặc một Orchestrator ở Phase sau trách nhiệm: "Chỉ phát Candle 21 khi nhận được tín hiệu PIPELINE_DONE của Candle 20". Trong Phase 2 hiện tại, ta cứ cho pipeline xử lý song song để chứng minh luồng dữ liệu trơn tru.

Phương án này đáp ứng tuyệt đối yêu cầu: Không thêm Database, không thêm thư viện, giữ nguyên kiến trúc Event Sourcing, sửa code cực ít, và tuân thủ chặt chẽ Contract.
