import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RobotResolver } from '../../adapters/tradingview/RobotResolver';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { getSupabaseAdmin } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => {
  return {
    getSupabaseAdmin: vi.fn(() => ({
      from: () => ({
        select: () => ({
          eq: (field: string, value: string) => ({
            single: async () => {
              if (value === 'RobotXAU') {
                return { data: { id: '12345678-1234-1234-1234-123456789abc' }, error: null };
              }
              return { data: null, error: { message: 'Not found' } };
            }
          })
        }),
        insert: async (data: any) => {
          // Dummy insert intercept
          return { error: null };
        }
      })
    }))
  };
});

describe('Data Contract V1: Robot ID Fix (Slug -> UUID)', () => {
  beforeEach(async () => {
    coreEventBus.clearAll();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it('R1: RobotXAU -> UUID', async () => {
    vi.stubEnv('NODE_ENV', 'development'); // Bypass test mock inside resolver
    const uuid = await RobotResolver.resolveSlugToUUID('RobotXAU');
    expect(uuid).toBe('12345678-1234-1234-1234-123456789abc');
    vi.unstubAllEnvs();
  });

  it('R2: Unknown slug -> ROBOT_NOT_FOUND (null)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const uuid = await RobotResolver.resolveSlugToUUID('UnknownSlug');
    expect(uuid).toBeNull();
    vi.unstubAllEnvs();
  });

  it('R3: Valid UUID is accepted by Core / EventBus', async () => {
    let capturedEvent: any = null;
    coreEventBus.subscribe('CANDLE_CLOSED', async (e) => {
      capturedEvent = e;
    });

    const uuid = '12345678-1234-1234-1234-123456789abc';
    const event = EventFactory.createEvent('CANDLE_CLOSED', uuid, 1 /* configVersion */, EventFactory.createTrace('corr-1', 'parent', 'test', 1), {});
    
    await coreEventBus.publish(event);
    await coreEventBus.waitForIdle(uuid);

    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.robotId).toBe(uuid);
  });

  it('R4: core_events.robot_id is UUID via EventBus', async () => {
    // We mock insert to check the payload
    let insertedData: any = null;
    vi.mocked(getSupabaseAdmin).mockImplementationOnce(() => ({
      from: (table: string) => {
        if (table === 'core_events') {
          return {
            insert: async (data: any) => {
              insertedData = data;
              return { error: null };
            }
          };
        }
        return { insert: async () => ({}) };
      }
    }) as any);

    const uuid = '12345678-1234-1234-1234-123456789abc';
    const event = EventFactory.createEvent('CANDLE_CLOSED', uuid, 1 /* configVersion */, EventFactory.createTrace('corr-2', 'parent', 'test', 2), {});
    
    await coreEventBus.publish(event);
    await coreEventBus.waitForIdle(uuid);

    expect(insertedData).not.toBeNull();
    expect(insertedData.robot_id).toBe(uuid);
    expect(insertedData.event_sequence).toBe(2);
    expect(insertedData.correlation_id).toBe('corr-2');
  });

  it('R6: Decision Trace fields exist properly', async () => {
    const uuid = '12345678-1234-1234-1234-123456789abc';
    const event = EventFactory.createEvent('CANDLE_CLOSED', uuid, 1 /* configVersion */, EventFactory.createTrace('corr-3', 'parent', 'test', 3), {});
    
    expect(event.trace).toBeDefined();
    expect(event.trace.correlationId).toBe('corr-3');
    expect(event.trace.parentId).toBe('parent');
    expect(event.trace.sequence).toBe(3);
  });
});
