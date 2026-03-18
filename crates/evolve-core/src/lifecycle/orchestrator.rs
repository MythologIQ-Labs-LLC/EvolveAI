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

    pub fn phase(&self) -> Phase {
        self.state.phase
    }

    pub fn state(&self) -> &LifecycleState {
        &self.state
    }

    pub fn trace_count(&self) -> usize {
        self.state.traces.len()
    }

    /// IDLE → GROUNDING → IDLE (session start with budget).
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
    /// or IDLE → SEMANTIC_PAUSE → IDLE (safety blocked).
    pub fn begin_operation(
        &mut self,
        safety_passed: bool,
        now: i64,
    ) -> Result<(), LifecycleError> {
        self.assert_phase(Phase::Idle)?;
        self.transition(Phase::SemanticPause, "begin_operation", now);
        if safety_passed {
            self.transition(Phase::ActiveFlow, "safety_pass", now);
        } else {
            self.transition(Phase::Idle, "safety_block", now);
        }
        Ok(())
    }

    /// Record an operation trace during ACTIVE_FLOW.
    pub fn record_operation(
        &mut self,
        trace: PipelineTrace,
    ) -> Result<(), LifecycleError> {
        self.assert_phase(Phase::ActiveFlow)?;
        if let Some(budget) = &mut self.state.budget {
            budget.consume();
        }
        self.state.traces.push(trace);
        Ok(())
    }

    /// ACTIVE_FLOW → DETACHMENT → (REM_SYNTHESIS or IDLE).
    /// Returns true if synthesis is needed.
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

    /// REM_SYNTHESIS → IDLE. Returns accumulated traces for processing.
    pub fn complete_synthesis(
        &mut self,
        now: i64,
    ) -> Result<Vec<PipelineTrace>, LifecycleError> {
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
