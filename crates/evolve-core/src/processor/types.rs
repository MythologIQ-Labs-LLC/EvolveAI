use crate::memory::types::{MemoryUnit, RecallResult};
use crate::tiers::router::RouteDecision;

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
}
