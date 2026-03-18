# Plan: v3.4 Lifecycle Orchestrator

## Open Questions

1. **Fiber budget enforcement**: Should the orchestrator actively refuse operations when budget is exhausted, or just track? **Decision**: Track + report. The caller decides whether to respect the budget. This avoids complecting resource policy with orchestration.

2. **REM synthesis behavior**: In TypeScript, synthesis consolidates traces into memories. Should this be automatic? **Decision**: Explicit — the caller triggers synthesis when ready. The orchestrator accumulates traces but doesn't auto-synthesize.

---

## Phase 1: Lifecycle Types & State Machine

### Affected Files

- `crates/evolve-core/src/lifecycle/mod.rs` — NEW: Module root
- `crates/evolve-core/src/lifecycle/types.rs` — NEW: Phase, LifecycleState, transitions
- `crates/evolve-core/src/lifecycle/orchestrator.rs` — NEW: State machine
- `crates/evolve-core/src/lib.rs` — Add `pub mod lifecycle;`

### Changes

**crates/evolve-core/src/lifecycle/types.rs**

```rust
use serde::{Deserialize, Serialize};

/// The 5 metabolic phases + idle.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Phase {
    Idle,
    Grounding,
    SemanticPause,
    ActiveFlow,
    Detachment,
    RemSynthesis,
}

/// Record of a phase transition.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PhaseTransition {
    pub from: Phase,
    pub to: Phase,
    pub timestamp: i64,
    pub trigger: String,
}

/// Pipeline trace — record of an operation during ActiveFlow.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PipelineTrace {
    pub operation: String,
    pub started_at: i64,
    pub ended_at: i64,
    pub success: bool,
    pub error: Option<String>,
}

/// Resource budget for the session.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FiberBudget {
    pub total_ops: u32,
    pub remaining_ops: u32,
    pub time_budget_ms: i64,
    pub started_at: i64,
}

impl FiberBudget {
    pub fn new(total_ops: u32, time_budget_ms: i64, now: i64) -> Self {
        Self { total_ops, remaining_ops: total_ops, time_budget_ms, started_at: now }
    }

    pub fn has_budget(&self, now: i64) -> bool {
        self.remaining_ops > 0 && (now - self.started_at) < self.time_budget_ms
    }

    pub fn consume(&mut self) {
        self.remaining_ops = self.remaining_ops.saturating_sub(1);
    }
}

/// Full lifecycle state.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LifecycleState {
    pub phase: Phase,
    pub session_id: String,
    pub budget: Option<FiberBudget>,
    pub traces: Vec<PipelineTrace>,
    pub transitions: Vec<PhaseTransition>,
}
```

**crates/evolve-core/src/lifecycle/orchestrator.rs**

```rust
use crate::lifecycle::types::*;

/// Lifecycle configuration.
#[derive(Clone, Debug)]
pub struct LifecycleConfig {
    pub default_ops_budget: u32,
    pub default_time_budget_ms: i64,
    pub synthesis_threshold: usize,
}

impl Default for LifecycleConfig {
    fn default() -> Self {
        Self {
            default_ops_budget: 1000,
            default_time_budget_ms: 30_000,
            synthesis_threshold: 10,
        }
    }
}

/// Lifecycle orchestrator — state machine for the metabolic lifecycle.
pub struct Orchestrator {
    state: LifecycleState,
    config: LifecycleConfig,
}

impl Orchestrator {
    pub fn new(session_id: String, config: LifecycleConfig) -> Self {
        Self {
            state: LifecycleState {
                phase: Phase::Idle,
                session_id,
                budget: None,
                traces: Vec::new(),
                transitions: Vec::new(),
            },
            config,
        }
    }

    pub fn phase(&self) -> Phase { self.state.phase }
    pub fn state(&self) -> &LifecycleState { &self.state }

    /// IDLE → GROUNDING → IDLE (session start with budget)
    pub fn start_session(&mut self, now: i64) -> Result<(), LifecycleError> {
        self.assert_phase(Phase::Idle)?;
        self.transition(Phase::Grounding, "start_session", now);
        self.state.budget = Some(FiberBudget::new(
            self.config.default_ops_budget,
            self.config.default_time_budget_ms,
            now,
        ));
        self.transition(Phase::Idle, "grounding_complete", now);
        Ok(())
    }

    /// IDLE → SEMANTIC_PAUSE → ACTIVE_FLOW (safety passed)
    /// or IDLE → SEMANTIC_PAUSE → IDLE (safety blocked)
    pub fn begin_operation(&mut self, safety_passed: bool, now: i64) -> Result<(), LifecycleError> {
        self.assert_phase(Phase::Idle)?;
        self.transition(Phase::SemanticPause, "begin_operation", now);
        if safety_passed {
            self.transition(Phase::ActiveFlow, "safety_pass", now);
        } else {
            self.transition(Phase::Idle, "safety_block", now);
        }
        Ok(())
    }

    /// Record an operation trace during ACTIVE_FLOW. Consumes one budget unit.
    pub fn record_operation(&mut self, trace: PipelineTrace, now: i64) -> Result<(), LifecycleError> {
        self.assert_phase(Phase::ActiveFlow)?;
        if let Some(budget) = &mut self.state.budget {
            budget.consume();
        }
        self.state.traces.push(trace);
        Ok(())
    }

    /// ACTIVE_FLOW → DETACHMENT → (REM_SYNTHESIS or IDLE)
    pub fn detach(&mut self, now: i64) -> Result<bool, LifecycleError> {
        self.assert_phase(Phase::ActiveFlow)?;
        self.transition(Phase::Detachment, "detach", now);
        let should_synthesize = self.state.traces.len() >= self.config.synthesis_threshold;
        if should_synthesize {
            self.transition(Phase::RemSynthesis, "synthesis_threshold", now);
        } else {
            self.transition(Phase::Idle, "detach_complete", now);
        }
        Ok(should_synthesize)
    }

    /// REM_SYNTHESIS → IDLE (clear processed traces)
    pub fn complete_synthesis(&mut self, now: i64) -> Result<Vec<PipelineTrace>, LifecycleError> {
        self.assert_phase(Phase::RemSynthesis)?;
        let traces = std::mem::take(&mut self.state.traces);
        self.transition(Phase::Idle, "synthesis_complete", now);
        Ok(traces)
    }

    /// Force reset to IDLE.
    pub fn reset(&mut self, now: i64) {
        self.transition(Phase::Idle, "reset", now);
        self.state.traces.clear();
    }

    /// Check if budget remains.
    pub fn has_budget(&self, now: i64) -> bool {
        self.state.budget.as_ref().map_or(true, |b| b.has_budget(now))
    }

    fn transition(&mut self, to: Phase, trigger: &str, now: i64) {
        self.state.transitions.push(PhaseTransition {
            from: self.state.phase,
            to,
            timestamp: now,
            trigger: trigger.to_string(),
        });
        self.state.phase = to;
    }

    fn assert_phase(&self, expected: Phase) -> Result<(), LifecycleError> {
        if self.state.phase != expected {
            return Err(LifecycleError::InvalidPhase {
                expected,
                actual: self.state.phase,
            });
        }
        Ok(())
    }
}

/// Lifecycle errors.
#[derive(Debug, thiserror::Error)]
pub enum LifecycleError {
    #[error("invalid phase: expected {expected:?}, got {actual:?}")]
    InvalidPhase { expected: Phase, actual: Phase },
}
```

### Unit Tests

- `crates/evolve-core/src/lifecycle/tests.rs`
  - `test_initial_state_is_idle` — New orchestrator starts in Idle
  - `test_start_session_creates_budget` — Budget initialized after start
  - `test_begin_operation_safety_pass` — Transitions Idle → SemanticPause → ActiveFlow
  - `test_begin_operation_safety_block` — Transitions Idle → SemanticPause → Idle
  - `test_record_operation_consumes_budget` — Budget decrements
  - `test_detach_below_threshold` — Returns false, transitions to Idle
  - `test_detach_above_threshold` — Returns true, transitions to RemSynthesis
  - `test_complete_synthesis_returns_traces` — Traces returned and cleared
  - `test_invalid_phase_returns_error` — Wrong phase produces error
  - `test_reset_clears_state` — Reset returns to Idle with empty traces

---

## Phase 2: Processor Integration

### Affected Files

- `crates/evolve-core/src/processor/facade.rs` — Add orchestrator to processor
- `crates/evolve-core/src/processor/types.rs` — Add lifecycle state to ProcessorStats

### Changes

**crates/evolve-core/src/processor/facade.rs** — add orchestrator:

```rust
use crate::lifecycle::orchestrator::{Orchestrator, LifecycleConfig};
use crate::lifecycle::types::{Phase, PipelineTrace};

// Add to ProcessorConfig:
pub lifecycle: LifecycleConfig,

// Add to MemoryProcessor struct:
lifecycle: Orchestrator,

// Add to new():
lifecycle: Orchestrator::new(uuid::Uuid::new_v4().to_string(), config.lifecycle.clone()),

// New methods:

/// Start a lifecycle session.
pub fn start_session(&mut self, now: i64) -> Result<(), LifecycleError> {
    self.lifecycle.start_session(now)
}

/// Get current lifecycle phase.
pub fn phase(&self) -> Phase {
    self.lifecycle.phase()
}

// Update encode() to record operation trace when in ActiveFlow:
// (only if phase is ActiveFlow — otherwise just encode normally)

// Update stats() to include lifecycle phase.
```

**crates/evolve-core/src/processor/types.rs** — extend ProcessorStats:

```rust
use crate::lifecycle::types::Phase;

// Add to ProcessorStats:
pub phase: Phase,
pub trace_count: usize,
pub budget_remaining: Option<u32>,
```

### Unit Tests

- `crates/evolve-core/src/processor/tests.rs` (append)
  - `test_processor_lifecycle_start` — Start session, verify phase transitions
  - `test_processor_lifecycle_full_cycle` — Start → begin → encode → detach → idle

---

## Summary

| Phase | Focus | New Files | Changes |
|-------|-------|-----------|---------|
| 1 | Types + Orchestrator state machine | 4 new | 1 modified (lib.rs) |
| 2 | Processor integration | 0 | 2 modified |

### Design Principles Applied

1. **Simple over Easy**: State machine with explicit transitions — no implicit state changes
2. **Values over State**: `LifecycleState` is serializable, transitions are recorded as values
3. **Declarative**: Phase transitions declared by trigger name, not imperative code paths
4. **Composable**: Orchestrator is standalone — usable without the processor
5. **No complecting**: Budget tracking (data) is separate from budget enforcement (policy)

---

_Plan follows Simple Made Easy principles_
