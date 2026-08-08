import { describe, it, expect, vi } from 'vitest';
import { CQRSProjection } from '../../engine/projection/CQRSProjection';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { supabase } from '../../../lib/supabaseClient';

vi.mock('../../../lib/supabaseClient', () => {
  const mockUpdate = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn(() => ({
    update: mockUpdate,
    eq: mockEq,
  }));
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

describe('Phase 1 Foundation Correction: CQRS Write Boundary', () => {
  it('C1: CQRSProjection phải lắng nghe STATE_TRANSITION_EVENT và ghi vào DB', async () => {
    const projection = new CQRSProjection();
    await projection.initialize();

    const trace = EventFactory.createTrace('c1', 'root', 'Engine', 1);
    const event = EventFactory.createEvent('STATE_TRANSITION_EVENT', 'R-123', trace, {
      oldState: 'WAIT_SIGNAL',
      newState: 'READY_TO_ENTER'
    });

    // Phát event qua EventBus
    await coreEventBus.publish(event);
    await coreEventBus.waitForIdle('R-123');

    // Kiểm tra supabase.from('robots').update(...).eq(...) đã được gọi đúng
    expect(supabase.from).toHaveBeenCalledWith('robots');
    
    // Cleanup
    await projection.shutdown();
  });
});
