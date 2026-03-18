use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Universal Object Reference - unique memory identifier.
pub type UorId = Uuid;

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

/// Encoded memory unit stored in the tier system.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MemoryUnit {
    pub uor_id: UorId,
    pub embedding: Vec<f32>,
    pub content_hash: String,
    pub created_at: i64,
    pub last_accessed: i64,
    pub access_count: u32,
    pub decay_factor: f32,
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
