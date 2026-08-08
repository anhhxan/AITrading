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
   * Tạo Robot mới
   */
  async createRobot(payload: Partial<RobotProfile>): Promise<string> {
    throw new Error('CQRS Violation: RobotRepository is read-only. Use Command/Event flow to create.');
  }

  /**
   * Chuyển trạng thái Robot
   */
  async updateState(robotId: string, newState: string): Promise<void> {
    throw new Error('CQRS Violation: RobotRepository is read-only. Use Command/Event flow to update state.');
  }

  /**
   * Soft Delete Robot
   */
  async softDeleteRobot(robotId: string): Promise<void> {
    throw new Error('CQRS Violation: RobotRepository is read-only. Use Command/Event flow to delete.');
  }
}
