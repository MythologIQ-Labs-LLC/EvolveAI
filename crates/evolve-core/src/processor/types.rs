use crate::chain::block::Block;
use crate::memory::decoder::DecoderConfig;
use crate::memory::encoder::EncoderConfig;
use crate::memory::types::{MemoryUnit, RecallResult, Tier, UorAddress};
use crate::processor::slo::{PressureConfig, SloThresholds};
use crate::processor::trust::CrystallizationPolicy;
use crate::shadow::interceptor::InterceptorConfig;
use crate::shadow::types::ShadowEntry;
use crate::tiers::l2_graph::Edge;
use crate::tiers::router::RouteDecision;
use crate::lifecycle::orchestrator::LifecycleConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Result of encoding a memory.
#[derive(Clone, Debug)]
pub struct EncodeResult {
    pub unit: MemoryUnit,
    pub decision: RouteDecision,
}

/// Result of querying memory.
#[derive(Clone, Debug)]
pub struct QueryResult {
    pub recall: RecallResult,
    pub latency_ms: u64,
}

/// System stats snapshot.
#[derive(Clone, Debug)]
pub struct ProcessorStats {
    pub l1_size: usize,
    pub l2_nodes: usize,
    pub l2_edges: usize,
    pub l3_size: usize,
    pub l3_chain_length: usize,
    pub l3_integrity: bool,
    pub phase: crate::lifecycle::types::Phase,
    pub trace_count: usize,
}

/// Persistable snapshot of the memory system state.
/// Captures L2 graph and L3 vault. L1 is intentionally excluded (ephemeral).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Snapshot {
    pub version: String,
    pub created_at: i64,
    pub l2_nodes: Vec<MemoryUnit>,
    pub l2_edges: HashMap<UorAddress, Vec<Edge>>,
    pub l3_entries: Vec<MemoryUnit>,
    pub l3_blocks: Vec<Block>,
    pub shadow_entries: Vec<ShadowEntry>,
}

/// Current snapshot format version.
pub const SNAPSHOT_VERSION: &str = "5.0.0";

/// Configuration for the memory processor.
#[derive(Clone, Debug)]
pub struct ProcessorConfig {
    pub encoder: EncoderConfig,
    pub decoder: DecoderConfig,
    pub interceptor: InterceptorConfig,
    pub lifecycle: LifecycleConfig,
    pub l1_ttl_ms: i64,
    pub l1_max_size: usize,
    pub slo: SloThresholds,
    pub pressure: PressureConfig,
    pub crystallization: CrystallizationPolicy,
}

impl Default for ProcessorConfig {
    fn default() -> Self {
        Self {
            encoder: EncoderConfig::default(),
            decoder: DecoderConfig::default(),
            interceptor: InterceptorConfig::default(),
            lifecycle: LifecycleConfig::default(),
            l1_ttl_ms: 300_000,
            l1_max_size: 1000,
            slo: SloThresholds::default(),
            pressure: PressureConfig::default(),
            crystallization: CrystallizationPolicy::Auto,
        }
    }
}

/// Errors from persistence operations.
#[derive(Debug, thiserror::Error)]
pub enum PersistError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serialize(#[from] serde_json::Error),
    #[error("chain integrity verification failed after restore")]
    ChainIntegrityFailed,
    #[error("incompatible snapshot version: expected {expected}, found {found}")]
    IncompatibleVersion { expected: String, found: String },
}

/// Build tier list from optional constraint.
pub fn tier_list(require: Option<Tier>) -> Vec<Tier> {
    match require {
        Some(t) => vec![t],
        None => vec![Tier::L1, Tier::L2, Tier::L3],
    }
}
