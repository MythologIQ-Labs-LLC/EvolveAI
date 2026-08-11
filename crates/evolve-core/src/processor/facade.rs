use crate::lifecycle::orchestrator::{LifecycleError, Orchestrator};
use crate::lifecycle::types::{Phase, PipelineTrace};
use crate::memory::encoder;
use crate::memory::types::*;
use crate::processor::ingest;
use crate::processor::metabolism::{self, DecayTickReport, DetachReport};
use crate::processor::persist;
use crate::processor::profile::{self, CognitiveProfile};
use crate::processor::query as query_mod;
use crate::processor::slo::{SloReport, SloSample, SloTracker};
use crate::processor::trust::{self, CRYSTALLIZATION_THRESHOLD};
use crate::processor::types::{
    EncodeResult, PersistError, ProcessorConfig, ProcessorStats, QueryResult, Snapshot,
};
use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::shadow::genome::{ShadowGenome, ShadowStats};
use crate::shadow::interceptor::{self, Verdict};
use crate::shadow::types::{FailureCategory, FailureTrace};
use crate::tiers::l1_cache::L1Cache;
use crate::tiers::l2_graph::L2Graph;
use crate::tiers::l3_vault::L3Vault;
use std::sync::Mutex;

/// SLO events observed while recording a query sample; each is evidence of
/// a real failure and feeds the shadow genome.
struct SloSignals {
    chain_invalid: bool,
    circuit_opened: bool,
}

/// Central facade for the autopoietic memory system.
pub struct MemoryProcessor<E: RepresentationEngine> {
    engine: E,
    config: ProcessorConfig,
    l1: L1Cache,
    l2: L2Graph,
    l3: L3Vault,
    shadow: Mutex<ShadowGenome>,
    lifecycle: Mutex<Orchestrator>,
    session_log: Vec<(UorAddress, i64)>,
    slo_tracker: Mutex<SloTracker>,
}

impl<E: RepresentationEngine> MemoryProcessor<E> {
    /// Create a new processor with the given engine and config.
    pub fn new(engine: E, config: ProcessorConfig) -> Self {
        let lifecycle =
            Orchestrator::new(uuid::Uuid::new_v4().to_string(), config.lifecycle.clone());
        Self {
            l1: L1Cache::new(config.l1_ttl_ms, config.l1_max_size),
            l2: L2Graph::new(),
            l3: L3Vault::new(),
            shadow: Mutex::new(ShadowGenome::default()),
            lifecycle: Mutex::new(lifecycle),
            engine,
            slo_tracker: Mutex::new(SloTracker::new(
                config.slo.clone(),
                config.pressure.clone(),
                config.decoder.half_life_ms,
            )),
            config,
            session_log: Vec::new(),
        }
    }

    pub fn start_session(&mut self, now: i64) -> Result<(), LifecycleError> {
        self.lifecycle.lock().unwrap().start_session(now)
    }

    pub fn phase(&self) -> Phase {
        self.lifecycle.lock().unwrap().phase()
    }

    /// First activity from Idle enters ActiveFlow (via SemanticPause),
    /// honoring the session budget: exhausted budget keeps the system Idle.
    fn begin_lifecycle_op(&self, now: i64) {
        let mut lc = self.lifecycle.lock().unwrap();
        if lc.phase() == Phase::Idle && lc.has_budget(now) {
            let _ = lc.begin_operation(true, now);
        }
    }

    /// Record a pipeline trace for an operation performed during ActiveFlow.
    fn record_lifecycle_op(&self, operation: &str, now: i64, success: bool, error: Option<String>) {
        let mut lc = self.lifecycle.lock().unwrap();
        if lc.phase() == Phase::ActiveFlow {
            let _ = lc.record_operation(PipelineTrace {
                operation: operation.to_string(),
                started_at: now,
                ended_at: now,
                success,
                error,
            });
        }
    }

    /// Record a runtime failure into the shadow genome. The intent is
    /// embedded through the engine so the interceptor can match future
    /// intents against it; if the engine itself is down, the entry is kept
    /// without a matchable embedding (still visible in stats).
    async fn record_internal_failure(
        &self,
        category: FailureCategory,
        intent: &str,
        message: String,
        now: i64,
    ) {
        let embedding = match self.engine.encode(intent).await {
            Ok(rep) => rep.as_vector(),
            Err(_) => Vec::new(),
        };
        let trace = FailureTrace {
            category,
            severity: category.default_severity(),
            intent: intent.to_string(),
            message,
            timestamp: now,
        };
        self.shadow.lock().unwrap().ingest(trace, embedding, now);
    }

    pub async fn encode(
        &mut self,
        input: &RawInput,
        now: i64,
    ) -> Result<EncodeResult, EngineError> {
        self.begin_lifecycle_op(now);
        let result = self.encode_inner(input, now).await;
        match &result {
            Ok(_) => self.record_lifecycle_op("encode", now, true, None),
            Err(e) => {
                let msg = e.to_string();
                self.record_lifecycle_op("encode", now, false, Some(msg.clone()));
                self.record_internal_failure(
                    FailureCategory::IntegrationFailure,
                    "memory.encode",
                    msg,
                    now,
                )
                .await;
            }
        }
        result
    }

    async fn encode_inner(
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
            Tier::L2 => {
                self.l2.insert(unit.clone());
                self.l2
                    .link_to_session(&unit.address, &self.session_log, now);
                self.pin_session_peers(&unit.address, now);
                self.session_log.push((unit.address.clone(), now));
            }
            Tier::L3 => self
                .l3
                .store(unit.clone())
                .map_err(|e| EngineError::EncodingFailed(format!("L3 store rejected unit: {e}")))?,
        }

        Ok(EncodeResult { unit, decision })
    }

    /// Query across tiers and return scored results.
    pub async fn query(&self, query: &Query, now: i64) -> Result<QueryResult, EngineError> {
        self.begin_lifecycle_op(now);
        let start = std::time::Instant::now();

        let allows_l3 = matches!(query.constraints.require_tier, None | Some(Tier::L3));
        if allows_l3 {
            if let Some(result) = query_mod::try_l3_exact_match(&self.l3, &query.content, start) {
                self.finish_query(&result, now).await;
                return Ok(result);
            }
        }

        let result = query_mod::vector_scan(
            &self.engine,
            &self.config.decoder,
            &self.l1,
            &self.l2,
            &self.l3,
            query,
            now,
            start,
        )
        .await;

        match result {
            Ok(result) => {
                self.finish_query(&result, now).await;
                Ok(result)
            }
            Err(e) => {
                let msg = e.to_string();
                self.record_lifecycle_op("query", now, false, Some(msg.clone()));
                self.record_internal_failure(
                    FailureCategory::IntegrationFailure,
                    "memory.query",
                    msg,
                    now,
                )
                .await;
                Err(e)
            }
        }
    }

    /// Record the SLO sample and lifecycle trace for a successful query,
    /// feeding any observed SLO failures into the shadow genome.
    async fn finish_query(&self, result: &QueryResult, now: i64) {
        let signals = self.record_slo_sample(result);
        if signals.chain_invalid {
            self.record_internal_failure(
                FailureCategory::SecurityRegression,
                "l3.integrity",
                "L3 hash chain failed integrity verification during query".to_string(),
                now,
            )
            .await;
        }
        if signals.circuit_opened {
            self.record_internal_failure(
                FailureCategory::ResourceExhaustion,
                "slo.circuit_breaker",
                "SLO error budget exhausted; circuit breaker opened".to_string(),
                now,
            )
            .await;
        }
        self.record_lifecycle_op("query", now, true, None);
    }

    /// Detachment → (RemSynthesis | Idle). When the accumulated traces reach
    /// the synthesis threshold, the REM-synthesis consolidation pass runs:
    /// the decay tick (prune/promote) executes and the traces are consumed
    /// via `complete_synthesis`, returning the system to Idle.
    pub fn detach(&mut self, now: i64) -> Result<DetachReport, LifecycleError> {
        let should_synthesize = self.lifecycle.lock().unwrap().detach(now)?;
        if !should_synthesize {
            return Ok(DetachReport {
                synthesized: false,
                traces_processed: 0,
                decay: None,
            });
        }
        let decay = self.run_decay_tick(now);
        let traces = self.lifecycle.lock().unwrap().complete_synthesis(now)?;
        Ok(DetachReport {
            synthesized: true,
            traces_processed: traces.len(),
            decay: Some(decay),
        })
    }

    /// Run one decay tick: evict expired L1 entries, prune decayed L2 units
    /// (cleaning their edges), and apply the v5.2 promotion rule under the
    /// Auto policy. L3 is never pruned. The half-life is pressure-adjusted
    /// from current tier utilization (v5.9).
    pub fn run_decay_tick(&mut self, now: i64) -> DecayTickReport {
        let half_life_ms = {
            let mut tracker = self.slo_tracker.lock().unwrap();
            tracker.update_pressure(self.l1.len(), self.config.l1_max_size, self.l2.node_count());
            tracker.evaluate().adjusted_half_life_ms
        };
        metabolism::run_decay_tick(
            &mut self.l1,
            &mut self.l2,
            &mut self.l3,
            self.config.crystallization,
            half_life_ms,
            self.config.decoder.decay_threshold,
            now,
        )
    }

    pub fn profile(&self, now: i64) -> CognitiveProfile {
        profile::compute(&self.l1, &self.l2, &self.l3, now, 10)
    }

    pub fn slo_report(&self) -> SloReport {
        self.slo_tracker.lock().unwrap().evaluate()
    }

    pub fn reset_slo(&self) {
        self.slo_tracker.lock().unwrap().reset_circuit();
    }

    fn record_slo_sample(&self, result: &QueryResult) -> SloSignals {
        let was_l3_direct = result.recall.metrics.tiers_queried == vec![Tier::L3]
            && result.recall.metrics.candidates_evaluated == 1;
        let chain_valid = self.l3.verify_integrity();
        let mut tracker = self.slo_tracker.lock().unwrap();
        tracker.update_pressure(self.l1.len(), self.config.l1_max_size, self.l2.node_count());
        let was_open = tracker.circuit_open();
        tracker.record(SloSample {
            latency_ms: result.latency_ms,
            was_l3_direct,
            chain_valid,
        });
        SloSignals {
            chain_invalid: !chain_valid,
            circuit_opened: tracker.circuit_open() && !was_open,
        }
    }

    pub fn stats(&self) -> ProcessorStats {
        let lc = self.lifecycle.lock().unwrap();
        ProcessorStats {
            l1_size: self.l1.len(),
            l2_nodes: self.l2.node_count(),
            l2_edges: self.l2.edge_count(),
            l3_size: self.l3.len(),
            l3_chain_length: self.l3.ledger().len(),
            l3_integrity: self.l3.verify_integrity(),
            phase: lc.phase(),
            trace_count: lc.trace_count(),
        }
    }

    pub fn health_check(&self) -> bool {
        self.l3.verify_integrity()
    }

    pub async fn check_safety(&mut self, intent: &str) -> Result<Verdict, EngineError> {
        let rep = self.engine.encode(intent).await?;
        let embedding = rep.as_vector();
        let mut shadow = self.shadow.lock().unwrap();
        Ok(interceptor::check_intent(
            &embedding,
            &mut shadow,
            &self.config.interceptor,
        ))
    }

    pub async fn record_failure(
        &mut self,
        trace: FailureTrace,
        now: i64,
    ) -> Result<(), EngineError> {
        let rep = self.engine.encode(&trace.intent).await?;
        let embedding = rep.as_vector();
        self.shadow.lock().unwrap().ingest(trace, embedding, now);
        Ok(())
    }

    /// Aggregate shadow genome statistics (for frontends to display).
    pub fn shadow_stats(&self) -> ShadowStats {
        self.shadow.lock().unwrap().stats()
    }

    pub fn clear_session(&mut self) {
        self.session_log.clear();
    }

    pub fn record_access(&mut self, addr: &UorAddress, event: PinningEvent) -> bool {
        trust::record_access(
            &mut self.l2,
            &mut self.l3,
            addr,
            event,
            self.config.crystallization,
        )
    }

    /// List L2 memories with σ≥0.95 awaiting crystallization approval.
    pub fn pending_crystallizations(&self) -> Vec<UorAddress> {
        self.l2
            .iter_units()
            .filter(|u| u.saturation >= CRYSTALLIZATION_THRESHOLD)
            .map(|u| u.address.clone())
            .collect()
    }

    fn pin_session_peers(&mut self, _new_addr: &UorAddress, _now: i64) {
        trust::pin_session_peers(&mut self.l2, &self.session_log);
    }

    /// Record a dispute against a memory. Besides injecting entropy, a
    /// dispute is evidence the memory was bad: the disputed unit's own
    /// embedding is recorded in the shadow genome as a Hallucination
    /// pattern, so similar future intents get flagged by the interceptor.
    pub fn record_conflict(&mut self, addr: &UorAddress, severity: f32) -> Option<f32> {
        let disputed = self
            .l2
            .get(addr)
            .or_else(|| self.l3.get_by_address(addr))
            .map(|u| (u.embedding.clone(), u.last_accessed));
        let outcome = trust::record_conflict(&mut self.l2, &mut self.l3, addr, severity);
        if outcome.is_some() {
            if let Some((embedding, observed_at)) = disputed {
                let trace = FailureTrace {
                    category: FailureCategory::Hallucination,
                    severity: metabolism::dispute_severity(severity),
                    intent: format!("memory.dispute:{addr}"),
                    message: format!("memory disputed with severity {severity:.2}"),
                    timestamp: observed_at,
                };
                self.shadow
                    .lock()
                    .unwrap()
                    .ingest(trace, embedding, observed_at);
            }
        }
        outcome
    }

    pub fn approve_crystallization(&mut self, addr: &UorAddress) -> bool {
        trust::approve_crystallization(&mut self.l2, &mut self.l3, addr)
    }

    pub fn snapshot(&self, now: i64) -> Snapshot {
        let shadow = self.shadow.lock().unwrap();
        persist::snapshot(&self.l2, &self.l3, &shadow, now)
    }

    pub fn restore(&mut self, snap: Snapshot) -> Result<(), PersistError> {
        let mut shadow = self.shadow.lock().unwrap();
        persist::restore(&mut self.l2, &mut self.l3, &mut shadow, snap)
    }

    pub fn save_to_file(&self, path: &std::path::Path, now: i64) -> Result<(), PersistError> {
        let shadow = self.shadow.lock().unwrap();
        persist::save_to_file(&self.l2, &self.l3, &shadow, path, now)
    }

    pub fn load_from_file(&mut self, path: &std::path::Path) -> Result<(), PersistError> {
        let mut shadow = self.shadow.lock().unwrap();
        persist::load_from_file(&mut self.l2, &mut self.l3, &mut shadow, path)
    }

    pub async fn ingest_file(
        &mut self,
        path: &std::path::Path,
        tags: Vec<String>,
        now: i64,
    ) -> Result<ingest::IngestResult, ingest::IngestError> {
        ingest::ingest_file(self, path, tags, &ingest::ChunkConfig::default(), now).await
    }

    pub fn forget(&mut self, addr: &UorAddress) -> bool {
        if self.l2.remove(addr).is_some() {
            return true;
        }
        if self.l3.remove(addr).is_some() {
            return true;
        }
        false
    }

    pub fn related(&self, addr: &UorAddress) -> Vec<&MemoryUnit> {
        self.l2.neighbors(addr)
    }

    pub fn association_count(&self, addr: &UorAddress) -> usize {
        self.l2.edges_from(addr).len()
    }
}
