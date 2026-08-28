import { getSupabaseAdmin } from '../../lib/supabase';

export class ReconciliationJob {
    private static intervalId: NodeJS.Timeout | null = null;

    /**
     * Khởi động Cron chạy mỗi khoảng thời gian (mặc định 5 phút = 300000ms)
     */
    public static start(intervalMs: number = 300000) {
        if (this.intervalId) return;
        console.log(`[ReconciliationJob] Started with interval ${intervalMs}ms`);
        this.intervalId = setInterval(() => this.run(), intervalMs);
        
        // Chạy ngay lần đầu tiên sau 10s
        setTimeout(() => this.run(), 10000);
    }

    public static stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log(`[ReconciliationJob] Stopped`);
        }
    }

    /**
     * Logic quét và dọn rác FAIL-SAFE
     */
    public static async run() {
        console.log('[ReconciliationJob] RECONCILIATION_SCAN started');
        const supabase = getSupabaseAdmin();

        try {
            // 1. Quét active_orders
            // Chỉ xem xét những order có trạng thái ngưng đọng (không còn chạy)
            const { data: deadOrders, error: orderErr } = await supabase
                .from('active_orders')
                .select('*')
                .in('status', ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'])
                .order('created_at', { ascending: false })
                .limit(1000);

            if (orderErr) {
                console.error('[ReconciliationJob] Error fetching active_orders:', orderErr);
                return;
            }

            if (deadOrders && deadOrders.length > 0) {
                for (const order of deadOrders) {
                    const isSafeToDelete = await this.verifySafeToDelete(supabase, order.robot_id, order.setup_id, order.status);
                    
                    if (isSafeToDelete) {
                        console.log(`[ReconciliationJob] ORPHAN_DETECTED: Order ${order.id} (status: ${order.status}, setup: ${order.setup_id})`);
                        const { error: delErr } = await supabase.from('active_orders').delete().eq('id', order.id);
                        if (!delErr) {
                            console.log(`[ReconciliationJob] ORPHAN_DELETED: Order ${order.id}`);
                        } else {
                            console.error(`[ReconciliationJob] Error deleting Order ${order.id}:`, delErr);
                        }
                    }
                }
            }

            // 2. Quét execution_intents
            const { data: deadIntents, error: intentErr } = await supabase
                .from('execution_intents')
                .select('*')
                .in('status', ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'])
                .order('created_at', { ascending: false })
                .limit(1000);

            if (intentErr) {
                console.error('[ReconciliationJob] Error fetching execution_intents:', intentErr);
                return;
            }

            if (deadIntents && deadIntents.length > 0) {
                for (const intent of deadIntents) {
                    const isSafeToDelete = await this.verifySafeToDelete(supabase, intent.robot_id, intent.setup_id, intent.status);
                    
                    if (isSafeToDelete) {
                        console.log(`[ReconciliationJob] ORPHAN_DETECTED: Intent ${intent.id} (status: ${intent.status}, setup: ${intent.setup_id})`);
                        const { error: delErr } = await supabase.from('execution_intents').delete().eq('id', intent.id);
                        if (!delErr) {
                            console.log(`[ReconciliationJob] ORPHAN_DELETED: Intent ${intent.id}`);
                        } else {
                            console.error(`[ReconciliationJob] Error deleting Intent ${intent.id}:`, delErr);
                        }
                    }
                }
            }

            console.log('[ReconciliationJob] RECONCILIATION_SCAN completed');
        } catch (error) {
            console.error('[ReconciliationJob] Exception during run:', error);
        }
    }

    /**
     * Xác minh FAIL-SAFE: Chỉ trả về true nếu chắc chắn 100% record này là rác.
     */
    private static async verifySafeToDelete(supabase: any, robotId: string, setupId: string | null, status: string): Promise<boolean> {
        if (!setupId) return true; // Không có setup_id -> Chắc chắn là rác dị thường, xóa luôn

        if (status === 'CANCELED' || status === 'REJECTED' || status === 'EXPIRED') {
            // Lệnh bị hủy/từ chối không sinh position. An toàn để xóa ngay.
            return true;
        }

        if (status === 'FILLED') {
            // BẮT BUỘC phải có active_position HOẶC trade_history tương ứng
            const { data: posData } = await supabase
                .from('active_positions')
                .select('id')
                .eq('robot_id', robotId)
                .eq('setup_id', setupId)
                .limit(1);

            if (posData && posData.length > 0) return true;

            const { data: histData } = await supabase
                .from('trade_history')
                .select('id')
                .eq('robot_id', robotId)
                .eq('setup_id', setupId)
                .limit(1);

            if (histData && histData.length > 0) return true;

            // Nếu FILLED nhưng ko thấy position đâu -> Lỗi cực kỳ nguy hiểm, KHÔNG XÓA!
            return false;
        }

        return false;
    }
}
