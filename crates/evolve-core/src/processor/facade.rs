use crate::chain::ledger::Ledger;
use crate::lifecycle::orchestrator::{LifecycleError, Orchestrator};
use crate::lifecycle::types::Phase;
use crate::memory::decoder;
use crate::memory::encoder;
use crate::memory::types::*;
use crate::processor::types::{
    EncodeResult, PersistError, ProcessorConfig, ProcessorStats,
    QueryResult, Snapshot, SNAPSHOT_VERSION, tier_list,
};
use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::shadow::genome::ShadowGenome;
use crate::shadow::interceptor::{self, Verdict};
use crate::shadow::types::FailureTrace;
use crate::tiers::l1_cache::L1Cache;
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;

/// Central facade for the autopoietic memory system.
pub struct MemoryProcessor<E: RepresentationEngine> {
    engine: E,
    config: ProcessorConfig,
    l1: L1Cache,
    l2: L2Graph,
    l3: L3Vault,
    shadow: ShadowGenome,
    lifecycle: Orchestrator,
}

impl<E: RepresentationEngine> MemoryProcessor<E> {
    /// Create a new processor with the given engine and config.
    pub fn new(engine: E, config: ProcessorConfig) -> Self {
        let lifecycle = Orchestrator::new(
            uuid::Uuid::new_v4().to_string(),
            config.lifecycle.clone(),
        );
        Self {
            l1: L1Cache::new(config.l1_ttl_ms, config.l1_max_size),
            l2: L2Graph::new(),
            l3: L3Vault::new(),
            shadow: ShadowGenome::default(),
            lifecycle,
            engine,
            config,
        }
    }

    pub fn start_session(&mut self, now: i64) -> Result<(), LifecycleError> {
        self.lifecycle.start_session(now)
    }

    pub fn phase(&self) -> Phase {
        self.lifecycle.phase()
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

        // Fast path: L3 exact match by content address (skip if tier-restricted away from L3)
        let allows_l3 = matches!(query.constraints.require_tier, None | Some(Tier::L3));
        if allows_l3 {
            if let Some(result) = self.try_l3_exact_match(&query.content, start) {
                return Ok(result);
            }
        }

        // Slow path: vector scan across tiers
        self.vector_scan_query(query, now, start).await
    }

    pub fn stats(&self) -> ProcessorStats {
        ProcessorStats {
            l1_size: self.l1.len(),
            l2_nodes: self.l2.node_count(),
            l2_edges: self.l2.edge_count(),
            l3_size: self.l3.len(),
            l3_chain_length: self.l3.ledger().len(),
            l3_integrity: self.l3.verify_integrity(),
            phase: self.lifecycle.phase(),
            trace_count: self.lifecycle.trace_count(),
        }
    }

    pub fn health_check(&self) -> bool {
        self.l3.verify_integrity()
    }

    pub async fn check_safety(&mut self, intent: &str) -> Result<Verdict, EngineError> {
        let rep = self.engine.encode(intent).await?;
        let embedding = rep.as_vector();
        Ok(interceptor::check_intent(&embedding, &mut self.shadow, &self.config.interceptor))
    }

    pub async fn record_failure(
        &mut self,
        trace: FailureTrace,
        now: i64,
    ) -> Result<(), EngineError> {
        let rep = self.engine.encode(&trace.intent).await?;
        self.shadow.ingest(trace, rep.as_vector(), now);
        Ok(())
    }

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

    pub fn save_to_file(&self, path: &std::path::Path, now: i64) -> Result<(), PersistError> {
        let snapshot = self.snapshot(now);
        let json = serde_json::to_string_pretty(&snapshot)?;
        let tmp = path.with_extension("tmp");
        std::fs::write(&tmp, &json)?;
        std::fs::rename(&tmp, path)?;
        Ok(())
    }

    pub fn load_from_file(&mut self, path: &std::path::Path) -> Result<(), PersistError> {
        let json = std::fs::read_to_string(path)?;
        let snapshot: Snapshot = serde_json::from_str(&json)?;
        self.restore(snapshot)
    }

    /// O(1) L3 exact match by content address.
    fn try_l3_exact_match(
        &self,
        content: &str,
        start: std::time::Instant,
    ) -> Option<QueryResult> {
        let query_address = UorAddress::from_content(content);
        let unit = self.l3.get_by_address(&query_address)?;
        let elapsed = start.elapsed().as_millis() as u64;

        Some(QueryResult {
            recall: RecallResult {
                memories: vec![ScoredMemory {
                    unit: unit.clone(),
                    relevance_score: 1.0,
                    decayed_weight: 1.0,
                }],
                metrics: RecallMetrics {
                    latency_ms: elapsed,
                    tiers_queried: vec![Tier::L3],
                    candidates_evaluated: 1,
                    decay_filtered: 0,
                },
            },
            latency_ms: elapsed,
        })
    }

    /// Vector scan across tiers (slow path).
    async fn vector_scan_query(
        &self,
        query: &Query,
        now: i64,
        start: std::time::Instant,
    ) -> Result<QueryResult, EngineError> {
        let rep = self.engine.encode(&query.content).await?;
        let query_embedding = rep.as_vector();
        let candidates = self.collect_candidates(query, now);
        let tiers_queried = tier_list(query.constraints.require_tier);
        let total_candidates = candidates.len();

        let memories = decoder::decode(&candidates, &query_embedding, now, &self.config.decoder);
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
