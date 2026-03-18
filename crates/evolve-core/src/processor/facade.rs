use crate::chain::ledger::Ledger;
use crate::memory::decoder::{self, DecoderConfig};
use crate::memory::encoder::{self, EncoderConfig};
use crate::memory::types::*;
use crate::processor::types::{
    EncodeResult, PersistError, ProcessorStats, QueryResult, Snapshot, SNAPSHOT_VERSION,
};
use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::shadow::genome::ShadowGenome;
use crate::shadow::interceptor::{self, InterceptorConfig, Verdict};
use crate::shadow::types::FailureTrace;
use crate::tiers::l1_cache::L1Cache;
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;

/// Configuration for the memory processor.
#[derive(Clone, Debug)]
pub struct ProcessorConfig {
    pub encoder: EncoderConfig,
    pub decoder: DecoderConfig,
    pub interceptor: InterceptorConfig,
    pub l1_ttl_ms: i64,
    pub l1_max_size: usize,
}

impl Default for ProcessorConfig {
    fn default() -> Self {
        Self {
            encoder: EncoderConfig::default(),
            decoder: DecoderConfig::default(),
            interceptor: InterceptorConfig::default(),
            l1_ttl_ms: 300_000,
            l1_max_size: 1000,
        }
    }
}

/// Central facade for the autopoietic memory system.
///
/// Generic over `E` to avoid object-safety issues with RPITIT.
pub struct MemoryProcessor<E: RepresentationEngine> {
    engine: E,
    config: ProcessorConfig,
    l1: L1Cache,
    l2: L2Graph,
    l3: L3Vault,
    shadow: ShadowGenome,
}

impl<E: RepresentationEngine> MemoryProcessor<E> {
    /// Create a new processor with the given engine and config.
    pub fn new(engine: E, config: ProcessorConfig) -> Self {
        Self {
            l1: L1Cache::new(config.l1_ttl_ms, config.l1_max_size),
            l2: L2Graph::new(),
            l3: L3Vault::new(),
            shadow: ShadowGenome::default(),
            engine,
            config,
        }
    }

    /// Encode raw input and store in the appropriate tier.
    pub async fn encode(
        &mut self,
        input: &RawInput,
        now: i64,
    ) -> Result<EncodeResult, EngineError> {
        let unit = encoder::encode(input, &self.engine, &self.config.encoder, now).await?;
        let decision = crate::tiers::router::route_memory_unit(
            &unit,
            &self.config.encoder.mts_weights,
            &self.config.encoder.tier_thresholds,
        );

        match decision.tier {
            Tier::L1 => self.l1.insert(unit.clone(), now),
            Tier::L2 => self.l2.insert(unit.clone()),
            Tier::L3 => self.l3.store(unit.clone()),
        }

        Ok(EncodeResult { unit, decision })
    }

    /// Query across tiers and return scored results.
    pub async fn query(
        &self,
        query: &Query,
        now: i64,
    ) -> Result<QueryResult, EngineError> {
        let start = std::time::Instant::now();

        let rep = self.engine.encode(&query.content).await?;
        let query_embedding = rep.as_vector();

        let candidates: Vec<&MemoryUnit> = self.collect_candidates(query, now);
        let tiers_queried = tier_list(query.constraints.require_tier);
        let total_candidates = candidates.len();

        let memories = decoder::decode(
            &candidates,
            &query_embedding,
            now,
            &self.config.decoder,
        );

        let decay_filtered = total_candidates - memories.len();
        let elapsed = start.elapsed().as_millis() as u64;

        Ok(QueryResult {
            recall: RecallResult {
                memories,
                metrics: RecallMetrics {
                    latency_ms: elapsed,
                    tiers_queried,
                    candidates_evaluated: total_candidates,
                    decay_filtered,
                },
            },
            latency_ms: elapsed,
        })
    }

    /// Get system statistics.
    pub fn stats(&self) -> ProcessorStats {
        ProcessorStats {
            l1_size: self.l1.len(),
            l2_nodes: self.l2.node_count(),
            l2_edges: self.l2.edge_count(),
            l3_size: self.l3.len(),
            l3_chain_length: self.l3.ledger().len(),
            l3_integrity: self.l3.verify_integrity(),
        }
    }

    /// Health check — verifies L3 chain integrity.
    pub fn health_check(&self) -> bool {
        self.l3.verify_integrity()
    }

    /// Check intent safety against the shadow genome.
    pub async fn check_safety(&mut self, intent: &str) -> Result<Verdict, EngineError> {
        let rep = self.engine.encode(intent).await?;
        let embedding = rep.as_vector();
        Ok(interceptor::check_intent(&embedding, &mut self.shadow, &self.config.interceptor))
    }

    /// Record a failure trace into the shadow genome.
    pub async fn record_failure(
        &mut self,
        trace: FailureTrace,
        now: i64,
    ) -> Result<(), EngineError> {
        let rep = self.engine.encode(&trace.intent).await?;
        self.shadow.ingest(trace, rep.as_vector(), now);
        Ok(())
    }

    /// Capture a snapshot of the persistable system state.
    pub fn snapshot(&self, now: i64) -> Snapshot {
        Snapshot {
            version: SNAPSHOT_VERSION.to_string(),
            created_at: now,
            l2_nodes: self.l2.nodes_vec(),
            l2_edges: self.l2.edges_map().clone(),
            l3_entries: self.l3.entries_vec(),
            l3_blocks: self.l3.ledger().blocks().to_vec(),
            shadow_entries: self.shadow.export_entries(),
        }
    }

    /// Restore system state from a snapshot. Replaces L2, L3, and shadow.
    /// Verifies chain integrity and snapshot version before accepting.
    pub fn restore(&mut self, snapshot: Snapshot) -> Result<(), PersistError> {
        if snapshot.version != SNAPSHOT_VERSION {
            return Err(PersistError::IncompatibleVersion {
                expected: SNAPSHOT_VERSION.to_string(),
                found: snapshot.version,
            });
        }

        let ledger = Ledger::from_blocks(snapshot.l3_blocks);
        if !ledger.verify() {
            return Err(PersistError::ChainIntegrityFailed);
        }

        self.l2 = L2Graph::from_parts(snapshot.l2_nodes, snapshot.l2_edges);
        self.l3 = L3Vault::from_parts(snapshot.l3_entries, ledger);
        self.shadow.import_entries(snapshot.shadow_entries);
        Ok(())
    }

    /// Save system state to a JSON file.
    /// Uses write-to-temp-then-rename for atomic replacement.
    pub fn save_to_file(&self, path: &std::path::Path, now: i64) -> Result<(), PersistError> {
        let snapshot = self.snapshot(now);
        let json = serde_json::to_string_pretty(&snapshot)?;
        let tmp = path.with_extension("tmp");
        std::fs::write(&tmp, &json)?;
        std::fs::rename(&tmp, path)?;
        Ok(())
    }

    /// Load system state from a JSON file, replacing L2 and L3.
    /// Verifies chain integrity and version compatibility.
    pub fn load_from_file(&mut self, path: &std::path::Path) -> Result<(), PersistError> {
        let json = std::fs::read_to_string(path)?;
        let snapshot: Snapshot = serde_json::from_str(&json)?;
        self.restore(snapshot)
    }

    fn collect_candidates(&self, query: &Query, now: i64) -> Vec<&MemoryUnit> {
        let mut candidates: Vec<&MemoryUnit> = Vec::new();
        match query.constraints.require_tier {
            Some(Tier::L1) => candidates.extend(self.l1.iter_units(now)),
            Some(Tier::L2) => candidates.extend(self.l2.iter_units()),
            Some(Tier::L3) => candidates.extend(self.l3.iter_units()),
            None => {
                candidates.extend(self.l1.iter_units(now));
                candidates.extend(self.l2.iter_units());
                candidates.extend(self.l3.iter_units());
            }
        }
        candidates
    }
}

fn tier_list(require: Option<Tier>) -> Vec<Tier> {
    match require {
        Some(t) => vec![t],
        None => vec![Tier::L1, Tier::L2, Tier::L3],
    }
}
