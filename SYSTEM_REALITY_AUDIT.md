# ARCHITECTURE & IMPLEMENTATION AUDIT
**Date:** 2026-08-08
**Scope:** Core Engine & UI Codebase

## PART 1 — PROJECT STRUCTURE
**Actual Directory Tree:**
- `src/core/`: IMPLEMENTED (Contains `engine`, `events`, `infrastructure`, `interfaces`, `locks`, `plugins`, `repositories`, `robot`, `__tests__`)
- `src/app/`: IMPLEMENTED (Next.js App router, UI)
- `src/components/`: IMPLEMENTED (UI Components)
- `src/lib/`: IMPLEMENTED (`supabaseClient.ts`, `utils.ts`)
- `src/repositories/`: **NOT IMPLEMENTED** (Located inside `src/core/repositories` instead)
- `src/types/`: **NOT IMPLEMENTED**
- `src/services/`: **NOT IMPLEMENTED**

**Core Engine Files (Sample):**
- `src/core/infrastructure/EventBus.ts`: IMPLEMENTED (Event queuing and dispatch)
- `src/core/infrastructure/EventFactory.ts`: IMPLEMENTED (Traceability and Event creation)
- `src/core/engine/market-data/MarketDataEngine.ts`: IMPLEMENTED (Receives OHLCV, emits CANDLE_CLOSED_EVENT)
- `src/core/engine/indicators/IndicatorEngine.ts`: IMPLEMENTED (Listens to CANDLE, emits INDICATOR_UPDATED)
- `src/core/engine/strategies/StrategyEngine.ts`: IMPLEMENTED (Emits SIGNAL_DETECTED)
- `src/core/engine/runtime/StateMachineEngine.ts`: IMPLEMENTED (Manages states, emits READY_TO_ENTER)
- `src/core/engine/runtime/PluginLoader.ts`: PARTIAL (Hardcoded plugin instantiation)

---

## PART 2 — CURRENT DATABASE & REPOSITORY
**Current Supabase Access:**
- `src/lib/supabaseClient.ts`: Exists for UI.
- `src/core/repositories/RobotRepository.ts`: 
  - Line 70: `supabase.from('robots').update({ status: 'STOPPED' })`
  - Line 82: `supabase.from('robots').update({ deleted: true })`

**CQRS / Persistence Contract Enforcement:**
- **FAIL / VIOLATION**: The architecture dictates that ONLY the Projection Layer (CQRS) writes to the DB. However, `RobotRepository.ts` directly issues `.update()` commands to Supabase, bypassing the event-driven Projection Layer.

---

## PART 3 — ENGINE CONTRACT v1.0.0 AUDIT

| Contract | Required | Actually Implemented | PASS/FAIL | Evidence |
|----------|----------|----------------------|-----------|----------|
| Event Contract | Yes | Yes | PASS | `EventFactory.ts`, `BaseEvent` interface. |
| RobotContext | Yes | No | FAIL | State is scattered in Maps inside individual engines. |
| DecisionTrace | Yes | Yes | PASS | `traceId`, `correlationId`, `sequence` exist. |
| Event Versioning | Yes | Yes | PASS | Hardcoded to `v1.0.0`. |
| IdempotencyKey | Yes | Yes (Generated) | PARTIAL | Generated but never verified. |
| Plugin Contract | Yes | Yes | PARTIAL | Interfaces exist but loaded via hardcoded `if`. |
| Replay Contract | Yes | No | FAIL | No Replay Engine exists. |
| Engine Orchestrator | Yes | Yes | PARTIAL | Orchestrator exists but missing Engine dependencies graph. |
| Persistence/CQRS | Yes | No | FAIL | Direct Supabase updates in Repositories. |

---

## PART 4 — EVENT BUS
**Analysis of `src/core/infrastructure/EventBus.ts`:**
1. **Entry:** `eventBus.publish(event)` pushes the event into `this.queues.get(robotId)`.
2. **FIFO:** Guaranteed *per Robot* by a `while(queue.length > 0)` loop and a `processing` boolean flag.
3. **Blocking:** Robot A does not block Robot B because they have separate queues and async workers.
4. **Error Handling:** `try/catch` around `handler(event)`. If it fails, error is logged and the event is **DROPPED** (Lost).
5. **Idempotency/Duplicate Prevention:** **NOT IMPLEMENTED**. `EventBus` blindly pushes and processes everything. `idempotencyKey` and `eventId` are ignored.
6. **Sequence Check:** **NOT IMPLEMENTED**. Out-of-order events are not blocked.
7. **Shutdown:** No shutdown mechanism exists in EventBus. Events arriving during shutdown will still process.

---

## PART 5 — CLOCK
**Search Results for Time Functions:**
- `src/core/infrastructure/Clock.ts`: `Date.now()`
- `src/core/projection/SnapshotWriter.ts`: `Clock.now()`
- `src/core/__tests__/phase1/clock.test.ts`: `Date.now()`
- `src/core/__tests__/phase2/benchmark-phase2.test.ts`: `performance.now()`
- `src/scripts/chaos.ts`: `Date.now()`

**Replay Viability:** `Clock.now()` wraps `Date.now()`. Replay *can* replace this implementation dynamically in JS, but it has not been done yet.

---

## PART 6 — EVENT FACTORY & TRACEABILITY
**Analysis of `EventFactory.ts`:**
- `eventId`: **Dynamic** (`uuidv4()`).
- `timestamp`: **Dynamic** (`Clock.now()`).
- `traceId`: **Dynamic** (`uuidv4()`).
- `idempotencyKey`: Deterministic (`robotId-eventType-corrId-sequence`).

**Verdict:** The current event generation is **NOT 100% DETERMINISTIC**. A test in Phase 3 explicitly strips `eventId` and `timestamp` from the hash because they mutate on every run. Replay cannot match exact hashes without mocking `uuid` and `Clock`.

---

## PART 7 — MARKET DATA ENGINE
**Pipeline:** `Provider -> subscribe() -> handleCandleClosed() -> Validator -> EventFactory -> coreEventBus`
- **Validation:** `MarketDataValidator` correctly rejects NaN/Infinity (`Number.isFinite`), negative volume, and `High < Open`.
- **Duplicate/Missing Candles:** **NOT HANDLED**. The engine blindly trusts the provider.
- **Reconnect:** Exponential backoff exists in `connectWithRetry()`.

---

## PART 8 — ORCHESTRATOR
**Analysis of `EngineOrchestrator.ts`:**
- Registers: `MarketDataEngine`.
- Starts: Sequentially `await engine.initialize()`.
- Error: If an engine crashes, it restarts *only* that engine (`this.handleEngineFailure`).
- Flaw: Only MarketDataEngine is registered in the current codebase orchestrator script. Indicator, Strategy, and StateMachine are tested in isolation but NOT fully wired into a global Orchestrator execution loop.

---

## PART 9 — CURRENT ENGINE STATUS

| Engine | File Exists | Implemented | Connected to EventBus | Tested | Status |
|--------|-------------|-------------|-----------------------|--------|--------|
| MarketData Engine | Yes | Yes | Yes | Yes | IMPLEMENTED |
| Indicator Engine | Yes | Yes | Yes | Yes | IMPLEMENTED |
| Strategy Engine | Yes | Yes | Yes | Yes | IMPLEMENTED |
| State Machine | Yes | Yes | Yes | Yes | IMPLEMENTED |
| Risk Engine | No | No | No | No | **MISSING** |
| Execution Engine | No | No | No | No | **MISSING** |
| Projection Layer | No | No | No | No | **MISSING** |
| Replay Engine | No | No | No | No | **MISSING** |

---

## PART 10 — CURRENT EVENT STATUS

| Event | Schema Exists | Factory/Emitted | Consumer Exists | Status |
|-------|---------------|-----------------|-----------------|--------|
| CANDLE_CLOSED | Yes | Yes | Yes | IMPLEMENTED |
| INDICATOR_UPDATED | Yes | Yes | Yes | IMPLEMENTED |
| SIGNAL_DETECTED | Yes | Yes | Yes | IMPLEMENTED |
| READY_TO_ENTER | Yes | Yes | No | IMPLEMENTED (No consumer) |
| ENTRY_TIMEOUT | Yes | Yes | No | IMPLEMENTED |
| MARKET_DATA_ERROR | No | No | No | **MISSING** |
| ORDER_CREATED | No | No | No | **MISSING** |
| POSITION_OPENED | No | No | No | **MISSING** |

---

## PART 11 — CURRENT PLUGIN SYSTEM
**Analysis of `PluginLoader.ts`:**
- Dynamic loading is **FAKE**. The code uses hardcoded `if (name === 'BB_MB') return new BB_MB_Indicator()`.
- Crash isolation works (`safeUpdate` uses `try/catch`).
- Warmup works (Indicators return `ready: false` until they have enough data).
- Hash, Versioning, Capability matrices are **NOT IMPLEMENTED**.

---

## PART 12 — TEST AUDIT
**Vitest Run Results (src/core):**
- **Test Files:** 15 passed
- **Tests:** 28 passed
- **Coverage:** Stmts: 56.74% | Branch: 46.87% | Funcs: 52.77% | Lines: 57.97%
- **Status:** Tests are running against REAL implementations (not mocks), but coverage is far from 100%.

---

## PART 13 — PHASE 1 CERTIFICATION AUDIT
- **FIFO:** PASS (Queue per robot).
- **Multi-Robot Parallelism:** PASS (Separate async loops).
- **MarketData Validation (NaN):** PASS (Fixed with `Number.isFinite`).
- **Idempotency:** **FAIL** (Key is generated but never checked; duplicate events will be processed twice).
- **CQRS:** **FAIL** (Direct DB writes in Repo).
- **Replay Determinism:** **PARTIAL** (Logic is deterministic, but Event ID / Timestamp generation drift, breaking strict hashing).

---

## PART 14 — PERFORMANCE
- **Benchmark:** `benchmark-phase2.test.ts`
- **Latency (Indicator Update):** 3.16 μs to 5.52 μs.
- **Throughput:** ~200,000 candles/sec capability.
- **Limitation:** This is a micro-benchmark for the Indicator isolated logic, NOT an End-to-End EventBus throughput proof.

---

## PART 15 — MEMORY / CHAOS
- Chaos test exists for MarketDataEngine retries.
- Queue corruption/event loss is **NOT PROVEN SAFE**. If an async handler crashes, the event is deleted from the queue without DLQ (Dead Letter Queue) or Retry. Event is lost forever.

---

## PART 16 — ACTUAL END-TO-END FLOW
**Current Implemented Flow:**
Mock Provider `CANDLE` -> `MarketDataEngine` -> Emit `CANDLE_CLOSED` -> `IndicatorEngine` -> Updates `BB_MB` -> Emits `INDICATOR_UPDATED` -> `StrategyEngine` -> Evaluates `BB_Strategy` -> Emits `SIGNAL_DETECTED` -> `StateMachineEngine` -> Waits for Retracement (`CANDLE_CLOSED`) -> Emits `READY_TO_ENTER`.
**STOP.** (Nothing consumes `READY_TO_ENTER` yet).

---

## PART 17 — UI CONNECTION
**Current UI State (`src/app`):**
- **A. Real DB Data:** Robots list might be fetched from Supabase, but heavily reliant on mock placeholders in UI components.
- **B. Real Core Events:** **NOT CONNECTED**. The UI does not listen to actual EventBus WebSockets.
- **D. Static/Demo Data:** Timeline, PnL, Decision Panel are largely static/mocked in UI state.

---

## PART 18 — ARCHITECTURE DRIFT (VIOLATIONS)
1. **CQRS Violation:** `RobotRepository.ts` calls `supabase.update()` directly.
2. **Determinism Violation:** `EventFactory.ts` hardcodes `uuidv4()` and `Clock.now()`, making bit-by-bit Replay Hash verification impossible without mocking the Factory.
3. **Plugin System:** Fake dynamic loading (Hardcoded).
4. **EventBus Safety:** Missing Idempotency Key checks and sequence validation. Events can be lost on crash.

---

## PART 19 — MISSING VS PLANNED

### A. ACTUALLY IMPLEMENTED
- EventBus (Basic FIFO routing).
- MarketData Validator & Engine.
- Indicator Engine & Strategy Engine (Isolated execution).
- State Machine (Signal -> Retracement logic).
- Basic UI shell.

### B. PARTIALLY IMPLEMENTED
- Orchestrator (Only connects MarketData, lacks dependency tree).
- Plugin System (Isolated but hardcoded).
- Event Traceability (Lacks strict Determinism).

### C. ONLY PLANNED / DOCUMENTED
- Risk Engine, Execution Engine, PnL Engine.
- CQRS Projection Layer.
- Replay Engine.
- WebSocket streaming to UI.
- Idempotency & Duplicate filtering.

---

## PART 20 — FINAL VERDICT

- **GREEN:** Engine Isolation, NaN Validation, Micro-Performance, Core Logic.
- **YELLOW:** Event Traceability, Orchestrator, Plugin System.
- **RED:** EventBus Reliability (Loss/Duplicates), CQRS Compliance, Replay Determinism.

1. **Genuinely complete:** Basic Event Pipeline up to `READY_TO_ENTER`.
2. **Not complete:** Risk, Execution, Persistence, Replay.
3. **Contradictions:** Direct Supabase writes in Repo, UUID/Date.now in Events, lack of EventBus Idempotency.
4. **Must be fixed before Phase 2 (or next phase):** 
   - Implement `IdempotencyStore` logic inside `EventBus`.
   - Strip dynamic values (UUID, Timestamp) from Event Hash calculation for Replay, OR inject a mock Clock/UUID generator.
   - Refactor `RobotRepository` to only READ, and use Projection for WRITES.
5. **Do NOT touch:** Indicator logic, Try/Catch Plugin isolation, MarketData validation rules (these are perfect).
6. **Should Phase 2 (or next) start?** NO. The foundations (CQRS & EventBus Reliability) must be patched before building Risk & Execution on top.
