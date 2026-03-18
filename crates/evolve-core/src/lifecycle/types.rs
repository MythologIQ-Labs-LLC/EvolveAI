use serde::{Deserialize, Serialize};

/// The 5 metabolic phases plus idle.
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
        Self {
            total_ops,
            remaining_ops: total_ops,
            time_budget_ms,
            started_at: now,
        }
    }

    /// Check if budget has remaining capacity.
    pub fn has_budget(&self, now: i64) -> bool {
        self.remaining_ops > 0 && (now - self.started_at) < self.time_budget_ms
    }

    /// Consume one operation unit.
    pub fn consume(&mut self) {
        self.remaining_ops = self.remaining_ops.saturating_sub(1);
    }
}

/// Full lifecycle state — serializable value.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LifecycleState {
    pub phase: Phase,
    pub session_id: String,
    pub budget: Option<FiberBudget>,
    pub traces: Vec<PipelineTrace>,
    pub transitions: Vec<PhaseTransition>,
}
