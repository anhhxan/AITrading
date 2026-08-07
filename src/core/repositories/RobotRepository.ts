import { supabase } from '../../lib/supabaseClient';

export interface RobotProfile {
  id: string;
  name: string;
  owner_id: string;
  trading_account_id: string;
  symbol: string;
  state: string;
}

export class RobotRepository {
  /**
   * Lấy danh sách Robot của User hiện tại (RLS sẽ tự động lọc)
   */
  async getRobotsByUser(): Promise<RobotProfile[]> {
    const { data, error } = await supabase
      .from('robots')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Lấy chi tiết Robot kèm cấu hình Version hiện tại
   */
  async getRobotDetail(robotId: string) {
    const { data, error } = await supabase
      .from('robots')
      .select(`
        *,
        versions:robot_versions (
          major, minor, patch,
          indicator:indicator_profile_id ( plugin_name, params ),
          strategy:strategy_profile_id ( plugin_name, params )
        )
      `)
      .eq('id', robotId)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    // Return latest version config
    return data;
  }

  /**
   * Tạo Robot mới (Chỉ INSERT, dùng UUID và trả về ID)
   */
  async createRobot(payload: Partial<RobotProfile>): Promise<string> {
    const { data, error } = await supabase
      .from('robots')
      .insert([payload])
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Chuyển trạng thái Robot (Cập nhật State)
   */
  async updateState(robotId: string, newState: string): Promise<void> {
    const { error } = await supabase
      .from('robots')
      .update({ state: newState, updated_at: new Date().toISOString() })
      .eq('id', robotId);

    if (error) throw error;
  }

  /**
   * Soft Delete Robot (Chỉ set deleted_at)
   */
  async softDeleteRobot(robotId: string): Promise<void> {
    const { error } = await supabase
      .from('robots')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', robotId);

    if (error) throw error;
  }
}
