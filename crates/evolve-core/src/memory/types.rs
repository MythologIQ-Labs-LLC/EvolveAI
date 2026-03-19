use serde::{Deserialize, Serialize};

/// Content-addressed memory identifier (BLAKE3 hex digest).
/// Two memories with identical content produce identical addresses.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UorAddress(pub String);

impl UorAddress {
    pub fn from_content(content: &str) -> Self {
        Self(crate::chain::hash::content_address(content))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for UorAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Raw input before encoding.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RawInput {
    pub content: String,
    pub content_type: ContentType,
    pub metadata: InputMetadata,
}

/// Classification of input content.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub enum ContentType {
    #[default]
    Text,
    Structured,
    Binary,
}

/// Metadata attached to raw input.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct InputMetadata {
    pub tags: Vec<String>,
    pub source: Option<String>,
    pub priority: Priority,
    pub sensitivity: Sensitivity,
}

/// Processing priority level.
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
pub enum Priority {
    Low,
    #[default]
    Normal,
    High,
    Critical,
}

/// Data sensitivity classification.
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
pub enum Sensitivity {
    #[default]
    Public,
    Internal,
    Confidential,
    Restricted,
}

/// Events that pin fibers, increasing saturation.
/// Weighted to prevent access spam from artificially crystallizing junk data.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum PinningEvent {
    Access,
    CrossReference,
    Corroboration,
    CryptoVerification,
}

/// Encoded memory unit stored in the tier system.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MemoryUnit {
    pub address: UorAddress,
    pub embedding: Vec<f32>,
    pub created_at: i64,
    pub last_accessed: i64,
    pub access_count: u32,
    pub saturation: f32,
    pub metadata: UnitMetadata,
}

/// Metadata associated with a stored memory unit.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct UnitMetadata {
    pub tags: Vec<String>,
    pub source: Option<String>,
    pub tier: Tier,
    pub mts_score: f32,
}

/// Memory tier classification (L1=hot cache, L2=graph, L3=vault).
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub enum Tier {
    #[default]
    L1,
    L2,
    L3,
}

/// Query for memory retrieval.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Query {
    pub content: String,
    pub constraints: QueryConstraints,
}

/// Constraints applied to a retrieval query.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct QueryConstraints {
    pub top_k: Option<usize>,
    pub min_relevance: Option<f32>,
    pub require_tier: Option<Tier>,
    pub exclude_decayed: bool,
}

/// A memory unit scored against a query.
#[derive(Clone, Debug)]
pub struct ScoredMemory {
    pub unit: MemoryUnit,
    pub relevance_score: f32,
    pub decayed_weight: f32,
}

/// Result of a memory retrieval operation.
#[derive(Clone, Debug)]
pub struct RecallResult {
    pub memories: Vec<ScoredMemory>,
    pub metrics: RecallMetrics,
}

/// Metrics captured during retrieval.
#[derive(Clone, Debug, Default)]
pub struct RecallMetrics {
    pub latency_ms: u64,
    pub tiers_queried: Vec<Tier>,
    pub candidates_evaluated: usize,
    pub decay_filtered: usize,
}
