use serde::{Deserialize, Serialize};

/// Categories of failure patterns tracked by the shadow genome.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FailureCategory {
    ComplexityViolation,
    PrematureOptimization,
    Hallucination,
    SecurityRegression,
    ScopeCreep,
    TechnicalDebt,
    ResourceExhaustion,
    IntegrationFailure,
    TestFailure,
    ValidationError,
}

/// Severity levels for failures.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

impl FailureCategory {
    /// Default severity for each failure category.
    pub fn default_severity(&self) -> Severity {
        match self {
            Self::SecurityRegression => Severity::Critical,
            Self::Hallucination | Self::IntegrationFailure | Self::TestFailure => Severity::High,
            Self::ComplexityViolation | Self::ScopeCreep
            | Self::ResourceExhaustion | Self::ValidationError => Severity::Medium,
            Self::PrematureOptimization | Self::TechnicalDebt => Severity::Low,
        }
    }
}

/// Record of a failure occurrence.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FailureTrace {
    pub category: FailureCategory,
    pub severity: Severity,
    pub intent: String,
    pub message: String,
    pub timestamp: i64,
}

/// Stored failure pattern with embedding for similarity matching.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ShadowEntry {
    pub id: String,
    pub embedding: Vec<f32>,
    pub category: FailureCategory,
    pub trace: FailureTrace,
    pub created_at: i64,
    pub trigger_count: u32,
    pub active: bool,
}
