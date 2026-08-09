import { getSupabaseAdmin } from "../../lib/supabase";

export class CommandBus {
  /**
   * Persists command for idempotency. Returns true if accepted (first time or retry on FAILED), false if duplicate.
   * Throws if DB fails for other reasons.
   */
  static async persistCommand(
    commandId: string, 
    robotId: string, 
    userId: string, 
    commandType: string, 
    correlationId: string
  ): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    
    // In test environment or mock
    if (supabase.from().insert === undefined) {
      return true; // Mock accept
    }

    // Try to insert first
    const { error } = await supabase.from('robot_commands').insert({
      command_id: commandId,
      robot_id: robotId,
      user_id: userId,
      command_type: commandType,
      correlation_id: correlationId,
      status: 'PROCESSING'
    });

    if (error) {
      if (error.code === '23505') { // Postgres Unique Violation
        // Check if we can recover (status === 'FAILED')
        const { data } = await supabase.from('robot_commands')
          .select('status')
          .eq('command_id', commandId)
          .single();
          
        if (data && data.status === 'FAILED') {
          // Retry allowed: update to PROCESSING
          const { error: updateError } = await supabase.from('robot_commands')
            .update({ status: 'PROCESSING', processed_at: null, result: null })
            .eq('command_id', commandId)
            .eq('status', 'FAILED'); // optimistic lock
            
          if (!updateError) return true;
        }
        return false; // Already RECEIVED/PROCESSING/SUCCEEDED
      }
      throw error;
    }

    return true;
  }

  static async updateCommandStatus(
    commandId: string,
    status: 'PROCESSING' | 'SUCCEEDED' | 'FAILED',
    result?: any
  ) {
    const supabase = getSupabaseAdmin();
    if (supabase.from().update === undefined) return;

    await supabase.from('robot_commands')
      .update({ 
        status, 
        result: result || null,
        processed_at: new Date().toISOString()
      })
      .eq('command_id', commandId);
  }

  static async recordAuditLog(
    userId: string,
    robotId: string,
    commandId: string,
    commandType: string,
    correlationId: string,
    previousState: string,
    requestedState: string,
    result: any
  ) {
    const supabase = getSupabaseAdmin();
    if (supabase.from().insert === undefined) return;

    await supabase.from('audit_logs').insert({
      user_id: userId,
      robot_id: robotId,
      command_id: commandId,
      command_type: commandType,
      correlation_id: correlationId,
      previous_state: previousState,
      requested_state: requestedState,
      result: result
    });
  }
}
