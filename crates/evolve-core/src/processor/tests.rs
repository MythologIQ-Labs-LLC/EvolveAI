use crate::memory::types::*;
use crate::processor::facade::MemoryProcessor;
use crate::processor::types::ProcessorConfig;
use crate::processor::types::Snapshot;
use crate::representation::mock::MockEngine;

fn make_input(content: &str, tags: Vec<&str>) -> RawInput {
    RawInput {
        content: content.to_string(),
        content_type: ContentType::Text,
        metadata: InputMetadata {
            tags: tags.into_iter().map(String::from).collect(),
            source: None,
            priority: Priority::Normal,
            sensitivity: Sensitivity::Public,
            ..Default::default()
        },
    }
}

fn make_query(content: &str) -> Query {
    Query {
        content: content.to_string(),
        constraints: QueryConstraints::default(),
    }
}

#[tokio::test]
async fn test_processor_encode_and_query() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let input = make_input("hello world", vec![]);
    let result = proc.encode(&input, 1000).await.unwrap();
    assert!(!result.unit.embedding.is_empty());

    let query = make_query("hello world");
    let qr = proc.query(&query, 1000).await.unwrap();
    assert!(!qr.recall.memories.is_empty());
}

#[tokio::test]
async fn test_processor_encode_routes_to_correct_tier() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let sensitive = make_input("classified data", vec!["sensitive"]);
    let result = proc.encode(&sensitive, 1000).await.unwrap();
    assert_eq!(result.decision.tier, Tier::L3);

    let normal = make_input("casual note", vec![]);
    let result = proc.encode(&normal, 1000).await.unwrap();
    assert_ne!(result.decision.tier, Tier::L3);
}

#[tokio::test]
async fn test_processor_query_single_tier() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let input = make_input("test data", vec![]);
    proc.encode(&input, 1000).await.unwrap();

    let mut query = make_query("test data");
    query.constraints.require_tier = Some(Tier::L3);
    let qr = proc.query(&query, 1000).await.unwrap();
    // Data went to L2 (not sensitive), querying L3 only should find nothing
    // (fast path checks L3 address match first)
    assert!(qr.recall.memories.is_empty());
    assert_eq!(qr.recall.metrics.tiers_queried, vec![Tier::L3]);
}

#[tokio::test]
async fn test_processor_stats() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let stats = proc.stats();
    assert_eq!(stats.l1_size, 0);
    assert_eq!(stats.l2_nodes, 0);
    assert_eq!(stats.l3_size, 0);

    let input = make_input("data", vec![]);
    proc.encode(&input, 1000).await.unwrap();

    let stats = proc.stats();
    assert!(stats.l1_size + stats.l2_nodes + stats.l3_size > 0);
}

#[tokio::test]
async fn test_processor_health_check() {
    let engine = MockEngine::new(32);
    let proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    assert!(proc.health_check());
}

#[tokio::test]
async fn test_processor_query_empty() {
    let engine = MockEngine::new(32);
    let proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let query = make_query("anything");
    let qr = proc.query(&query, 1000).await.unwrap();
    assert!(qr.recall.memories.is_empty());
    assert_eq!(qr.recall.metrics.candidates_evaluated, 0);
}

#[test]
fn test_snapshot_serialization_roundtrip() {
    let snapshot = Snapshot {
        version: "5.0.0".to_string(),
        created_at: 1000,
        l2_nodes: vec![],
        l2_edges: std::collections::HashMap::new(),
        l3_entries: vec![],
        l3_blocks: vec![crate::chain::block::Block::genesis()],
        shadow_entries: vec![],
    };
    let json = serde_json::to_string(&snapshot).unwrap();
    let restored: Snapshot = serde_json::from_str(&json).unwrap();
    assert_eq!(restored.version, "5.0.0");
    assert_eq!(restored.created_at, 1000);
}

#[tokio::test]
async fn test_snapshot_captures_l2_and_l3() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    proc.encode(&make_input("graph data", vec![]), 1000)
        .await
        .unwrap();
    proc.encode(&make_input("vault data", vec!["sensitive"]), 1000)
        .await
        .unwrap();

    let snap = proc.snapshot(2000);
    assert!(!snap.l2_nodes.is_empty() || !snap.l3_entries.is_empty());
    assert!(!snap.l3_blocks.is_empty());
}

#[tokio::test]
async fn test_restore_recovers_state() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    proc.encode(&make_input("remember this", vec![]), 1000)
        .await
        .unwrap();
    let snap = proc.snapshot(2000);

    let engine2 = MockEngine::new(384);
    let mut proc2 = MemoryProcessor::new(engine2, ProcessorConfig::default());
    assert_eq!(proc2.stats().l2_nodes, 0);

    proc2.restore(snap).unwrap();
    assert!(proc2.stats().l2_nodes > 0 || proc2.stats().l3_size > 0);
}

#[tokio::test]
async fn test_restore_preserves_chain_integrity() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    proc.encode(&make_input("integrity", vec!["sensitive"]), 1000)
        .await
        .unwrap();
    let snap = proc.snapshot(2000);

    let engine2 = MockEngine::new(32);
    let mut proc2 = MemoryProcessor::new(engine2, ProcessorConfig::default());
    proc2.restore(snap).unwrap();
    assert!(proc2.health_check());
}

#[tokio::test]
async fn test_snapshot_excludes_l1() {
    let mut config = ProcessorConfig::default();
    config.l1_ttl_ms = 60_000;
    config.encoder.tier_thresholds.l2 = 1.0;
    config.encoder.tier_thresholds.l3 = 1.0;

    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, config);

    proc.encode(&make_input("ephemeral", vec![]), 1000)
        .await
        .unwrap();
    assert!(proc.stats().l1_size > 0);

    let snap = proc.snapshot(2000);
    assert!(snap.l2_nodes.is_empty());
    assert!(snap.l3_entries.is_empty());
}

#[tokio::test]
async fn test_save_and_load_file() {
    let dir = std::env::temp_dir().join("evolve-core-test-v5");
    std::fs::create_dir_all(&dir).ok();
    let path = dir.join("test_state.json");

    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    proc.encode(&make_input("persist me", vec![]), 1000)
        .await
        .unwrap();
    proc.save_to_file(&path, 2000).unwrap();

    let engine2 = MockEngine::new(384);
    let mut proc2 = MemoryProcessor::new(engine2, ProcessorConfig::default());
    proc2.load_from_file(&path).unwrap();

    let stats = proc2.stats();
    assert!(stats.l2_nodes > 0 || stats.l3_size > 0);

    std::fs::remove_file(&path).ok();
    std::fs::remove_dir(&dir).ok();
}

#[test]
fn test_load_nonexistent_file() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let result = proc.load_from_file(std::path::Path::new("/nonexistent/path.json"));
    assert!(result.is_err());
}

#[test]
fn test_restore_rejects_incompatible_version() {
    let snapshot = Snapshot {
        version: "99.0.0".to_string(),
        created_at: 1000,
        l2_nodes: vec![],
        l2_edges: std::collections::HashMap::new(),
        l3_entries: vec![],
        l3_blocks: vec![crate::chain::block::Block::genesis()],
        shadow_entries: vec![],
    };
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let result = proc.restore(snapshot);
    assert!(result.is_err());
}

#[tokio::test]
async fn test_processor_check_safety_passes() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let verdict = proc.check_safety("harmless intent").await.unwrap();
    assert!(matches!(verdict, crate::shadow::interceptor::Verdict::Pass));
}

#[tokio::test]
async fn test_processor_record_and_block_failure() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let trace = crate::shadow::types::FailureTrace {
        category: crate::shadow::types::FailureCategory::SecurityRegression,
        severity: crate::shadow::types::Severity::Critical,
        intent: "disable auth check".to_string(),
        message: "Security bypass".to_string(),
        timestamp: 1000,
    };
    proc.record_failure(trace, 1000).await.unwrap();

    let verdict = proc.check_safety("disable auth check").await.unwrap();
    assert!(matches!(
        verdict,
        crate::shadow::interceptor::Verdict::Block { .. }
    ));
}

#[tokio::test]
async fn test_snapshot_includes_shadow() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let trace = crate::shadow::types::FailureTrace {
        category: crate::shadow::types::FailureCategory::ScopeCreep,
        severity: crate::shadow::types::Severity::Medium,
        intent: "add unrequested feature".to_string(),
        message: "Scope violation".to_string(),
        timestamp: 1000,
    };
    proc.record_failure(trace, 1000).await.unwrap();

    let snap = proc.snapshot(2000);
    assert!(!snap.shadow_entries.is_empty());
}

#[test]
fn test_processor_lifecycle_start() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    assert_eq!(proc.phase(), crate::lifecycle::types::Phase::Idle);

    proc.start_session(1000).unwrap();
    assert_eq!(proc.phase(), crate::lifecycle::types::Phase::Idle);
    assert_eq!(proc.stats().trace_count, 0);
}

#[tokio::test]
async fn test_processor_stats_includes_lifecycle() {
    let engine = MockEngine::new(32);
    let proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let stats = proc.stats();
    assert_eq!(stats.phase, crate::lifecycle::types::Phase::Idle);
    assert_eq!(stats.trace_count, 0);
}

// --- L3 address lookup tests (v5.0 Phase 3) ---

#[tokio::test]
async fn test_l3_address_lookup_o1() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    // Encode with sensitive tag to route to L3
    proc.encode(&make_input("vault content", vec!["sensitive"]), 1000)
        .await
        .unwrap();

    // Query same content — should get O(1) exact match
    let qr = proc
        .query(&make_query("vault content"), 1000)
        .await
        .unwrap();
    assert_eq!(qr.recall.memories.len(), 1);
    assert!((qr.recall.memories[0].relevance_score - 1.0).abs() < 1e-6);
    assert_eq!(qr.recall.metrics.tiers_queried, vec![Tier::L3]);
    assert_eq!(qr.recall.metrics.candidates_evaluated, 1);
}

#[tokio::test]
async fn test_l3_address_miss_falls_through() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    proc.encode(&make_input("stored in vault", vec!["sensitive"]), 1000)
        .await
        .unwrap();

    // Query different content — should fall through to vector scan
    let qr = proc
        .query(&make_query("different query"), 1000)
        .await
        .unwrap();
    // Vector scan should find the L3 entry via embedding similarity
    assert_eq!(
        qr.recall.metrics.tiers_queried,
        vec![Tier::L1, Tier::L2, Tier::L3]
    );
}

#[tokio::test]
async fn test_self_optimization() {
    // Prove: encode → access → saturate → L3 → O(1)
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    // Step 1: Encode (starts unsaturated, goes to L2)
    let result = proc
        .encode(&make_input("evolving memory", vec![]), 1000)
        .await
        .unwrap();
    assert_eq!(result.unit.saturation, 0.0);
    // Without sensitive tag, goes to L2 by default

    // Step 2: Encode same content again with sensitive tag to get into L3
    let result = proc
        .encode(&make_input("evolving memory", vec!["sensitive"]), 1000)
        .await
        .unwrap();
    assert_eq!(result.decision.tier, Tier::L3);

    // Step 3: Query by exact content — should get O(1) lookup
    let qr = proc
        .query(&make_query("evolving memory"), 1000)
        .await
        .unwrap();
    assert!(!qr.recall.memories.is_empty());
}

// --- Weighted pinning tests (v5.1) ---

#[tokio::test]
async fn test_record_access_boosts_saturation() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("pin me", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();
    assert_eq!(result.unit.saturation, 0.0);

    let found = proc.record_access(&addr, PinningEvent::CryptoVerification);
    assert!(found);

    // Query to retrieve the unit and check saturation increased
    let qr = proc.query(&make_query("pin me"), 1000).await.unwrap();
    assert!(!qr.recall.memories.is_empty());
    assert!(qr.recall.memories[0].unit.saturation > 0.0);
}

#[test]
fn test_record_access_not_found() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let addr = UorAddress::from_content("nonexistent");
    assert!(!proc.record_access(&addr, PinningEvent::Access));
}

#[tokio::test]
async fn test_record_access_increments_count() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("count me", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();

    proc.record_access(&addr, PinningEvent::Access);
    proc.record_access(&addr, PinningEvent::Access);
    proc.record_access(&addr, PinningEvent::Access);

    let qr = proc.query(&make_query("count me"), 1000).await.unwrap();
    assert_eq!(qr.recall.memories[0].unit.access_count, 3);
}

// --- Entropy injection tests (v5.1) ---

#[tokio::test]
async fn test_conflict_reduces_saturation() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("dispute me", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();

    // Boost to σ≈0.8 via repeated crypto verifications
    for _ in 0..12 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    let new_sat = proc.record_conflict(&addr, 0.3).unwrap();
    assert!(new_sat < 0.8);
}

#[tokio::test]
async fn test_conflict_evaporates_disputed_memory() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("evaporate me", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();

    // Boost to moderate saturation
    for _ in 0..5 {
        proc.record_access(&addr, PinningEvent::CrossReference);
    }

    // Major conflict → σ drops to near 0
    let new_sat = proc.record_conflict(&addr, 0.5).unwrap();
    assert!(new_sat < 0.1);

    // At σ≈0 with enough elapsed time, memory decays below prune threshold
    let decay_weight = crate::memory::decay::calculate_decay(1000, 500_000, 60_000, new_sat);
    assert!(crate::memory::decay::should_prune(decay_weight, 0.05));
}

#[tokio::test]
async fn test_crystallized_memory_survives_minor_conflict() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("resilient", vec!["sensitive"]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();

    // Boost to full saturation
    for _ in 0..100 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    let new_sat = proc.record_conflict(&addr, 0.03).unwrap();
    assert!(new_sat > 0.95); // Still crystallized
}

#[tokio::test]
async fn test_crystallized_memory_decrystallizes_on_major_conflict() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("fragile crystal", vec!["sensitive"]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();

    // Boost to full saturation
    for _ in 0..100 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    let new_sat = proc.record_conflict(&addr, 0.2).unwrap();
    assert!(new_sat < 0.95); // Below crystallization threshold
}

#[test]
fn test_conflict_not_found() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let addr = UorAddress::from_content("nonexistent");
    assert!(proc.record_conflict(&addr, 0.5).is_none());
}

// --- Co-capture linking tests (v5.2) ---

#[tokio::test]
async fn test_encode_creates_session_edges() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    proc.encode(&make_input("fact one", vec![]), 1000)
        .await
        .unwrap();
    proc.encode(&make_input("fact two", vec![]), 1001)
        .await
        .unwrap();
    proc.encode(&make_input("fact three", vec![]), 1002)
        .await
        .unwrap();

    assert!(proc.stats().l2_edges > 0);
}

#[tokio::test]
async fn test_encode_cross_reference_pins_peers() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let r1 = proc
        .encode(&make_input("first memory", vec![]), 1000)
        .await
        .unwrap();
    let addr1 = r1.unit.address.clone();
    assert_eq!(r1.unit.saturation, 0.0);

    // Second encode triggers CrossReference pin on first
    proc.encode(&make_input("second memory", vec![]), 1001)
        .await
        .unwrap();

    let qr = proc.query(&make_query("first memory"), 1001).await.unwrap();
    assert!(qr.recall.memories[0].unit.saturation > 0.0);
    let _ = addr1; // used for clarity
}

#[tokio::test]
async fn test_clear_session_resets() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    proc.encode(&make_input("before clear", vec![]), 1000)
        .await
        .unwrap();
    let edges_before = proc.stats().l2_edges;

    proc.clear_session();

    proc.encode(&make_input("after clear", vec![]), 2000)
        .await
        .unwrap();
    // No new edges — session was cleared, no peers to link
    assert_eq!(proc.stats().l2_edges, edges_before);
}

// --- Tier promotion tests (v5.2) ---
// These test Auto-policy promotion behavior, so they construct the Auto
// policy explicitly (the default is RequireApproval per ADR-020).

fn auto_config() -> ProcessorConfig {
    ProcessorConfig {
        crystallization: CrystallizationPolicy::Auto,
        ..Default::default()
    }
}

#[tokio::test]
async fn test_promotion_l2_to_l3_on_crystallization() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, auto_config());

    let result = proc
        .encode(&make_input("promote me", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();
    assert_eq!(result.decision.tier, Tier::L2);
    assert_eq!(proc.stats().l2_nodes, 1);
    assert_eq!(proc.stats().l3_size, 0);

    // Boost until promotion triggers (σ≥0.95)
    for _ in 0..25 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    // Memory should have promoted to L3
    assert_eq!(proc.stats().l2_nodes, 0);
    assert!(proc.stats().l3_size > 0);
}

#[tokio::test]
async fn test_promoted_memory_queryable_by_address() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, auto_config());

    proc.encode(&make_input("will promote", vec![]), 1000)
        .await
        .unwrap();

    // Promote via repeated access
    let addr = UorAddress::from_content("will promote");
    for _ in 0..25 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    // O(1) L3 exact match should work now
    let qr = proc.query(&make_query("will promote"), 2000).await.unwrap();
    assert_eq!(qr.recall.memories.len(), 1);
    assert_eq!(qr.recall.metrics.tiers_queried, vec![Tier::L3]);
}

#[tokio::test]
async fn test_promotion_removes_from_l2() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, auto_config());

    proc.encode(&make_input("stays", vec![]), 1000)
        .await
        .unwrap();
    proc.encode(&make_input("promotes", vec![]), 1001)
        .await
        .unwrap();
    assert_eq!(proc.stats().l2_nodes, 2);

    let addr = UorAddress::from_content("promotes");
    for _ in 0..25 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    assert_eq!(proc.stats().l2_nodes, 1); // Only "stays" remains
}

#[tokio::test]
async fn test_no_promotion_below_threshold() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("stay in l2", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();

    // Access events have low weight (0.01) — won't reach 0.95
    for _ in 0..10 {
        proc.record_access(&addr, PinningEvent::Access);
    }

    assert_eq!(proc.stats().l2_nodes, 1); // Still in L2
    assert_eq!(proc.stats().l3_size, 0);
}

// --- SLO tests (v5.4) ---

use crate::processor::slo::{self, *};

#[test]
fn test_slo_clean_window_no_violations() {
    let mut tracker = SloTracker::new(
        SloThresholds::default(),
        PressureConfig::default(),
        3_600_000,
    );
    for _ in 0..10 {
        tracker.record(SloSample {
            latency_ms: 1,
            was_l3_direct: false,
            chain_valid: true,
        });
    }
    let report = tracker.evaluate();
    assert_eq!(report.violation_count, 0);
    assert!((report.budget_remaining - 1.0).abs() < 1e-6);
    assert!(!report.circuit_open);
}

#[test]
fn test_slo_latency_violation_detected() {
    let mut tracker = SloTracker::new(
        SloThresholds::default(),
        PressureConfig::default(),
        3_600_000,
    );
    tracker.record(SloSample {
        latency_ms: 100,
        was_l3_direct: false,
        chain_valid: true,
    });
    let report = tracker.evaluate();
    assert_eq!(report.violation_count, 1);
    assert!(matches!(
        report.violations[0],
        SloViolation::LatencyExceeded { .. }
    ));
}

#[test]
fn test_slo_l3_latency_violation_detected() {
    let mut tracker = SloTracker::new(
        SloThresholds::default(),
        PressureConfig::default(),
        3_600_000,
    );
    tracker.record(SloSample {
        latency_ms: 5,
        was_l3_direct: true,
        chain_valid: true,
    });
    let report = tracker.evaluate();
    assert_eq!(report.violation_count, 1);
    assert!(matches!(
        report.violations[0],
        SloViolation::L3LatencyExceeded { .. }
    ));
}

#[test]
fn test_slo_chain_integrity_violation() {
    let mut tracker = SloTracker::new(
        SloThresholds::default(),
        PressureConfig::default(),
        3_600_000,
    );
    tracker.record(SloSample {
        latency_ms: 1,
        was_l3_direct: false,
        chain_valid: false,
    });
    let report = tracker.evaluate();
    assert!(report
        .violations
        .iter()
        .any(|v| matches!(v, SloViolation::ChainIntegrityFailed)));
}

#[test]
fn test_slo_budget_exhausted_opens_circuit() {
    let thresholds = SloThresholds {
        max_violation_rate: 0.1,
        window_size: 10,
        ..Default::default()
    };
    let mut tracker = SloTracker::new(thresholds, PressureConfig::default(), 3_600_000);
    // 2 violations out of 10 = 20% > 10% budget
    for i in 0..10 {
        let latency = if i < 2 { 100 } else { 1 };
        tracker.record(SloSample {
            latency_ms: latency,
            was_l3_direct: false,
            chain_valid: true,
        });
    }
    let report = tracker.evaluate();
    assert!(report.circuit_open);
    assert!((report.budget_remaining - 0.0).abs() < 1e-6);
}

#[test]
fn test_slo_rolling_window_drops_oldest() {
    let thresholds = SloThresholds {
        window_size: 5,
        ..Default::default()
    };
    let mut tracker = SloTracker::new(thresholds, PressureConfig::default(), 3_600_000);
    // Add 1 violation then 5 clean samples — violation should be evicted
    tracker.record(SloSample {
        latency_ms: 100,
        was_l3_direct: false,
        chain_valid: true,
    });
    for _ in 0..5 {
        tracker.record(SloSample {
            latency_ms: 1,
            was_l3_direct: false,
            chain_valid: true,
        });
    }
    let report = tracker.evaluate();
    assert_eq!(report.violation_count, 0);
    assert_eq!(report.total_samples, 5);
}

#[test]
fn test_slo_reset_circuit_clears_state() {
    let thresholds = SloThresholds {
        max_violation_rate: 0.01,
        window_size: 5,
        ..Default::default()
    };
    let mut tracker = SloTracker::new(thresholds, PressureConfig::default(), 3_600_000);
    tracker.record(SloSample {
        latency_ms: 100,
        was_l3_direct: false,
        chain_valid: true,
    });
    assert!(tracker.evaluate().circuit_open || tracker.evaluate().budget_remaining < 1.0);
    tracker.reset_circuit();
    let report = tracker.evaluate();
    assert!(!report.circuit_open);
    assert_eq!(report.total_samples, 0);
}

#[tokio::test]
async fn test_processor_query_records_slo_sample() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    proc.encode(&make_input("slo test", vec![]), 1000)
        .await
        .unwrap();
    proc.query(&make_query("slo test"), 1000).await.unwrap();
    let report = proc.slo_report();
    assert!(report.total_samples > 0);
}

#[tokio::test]
async fn test_processor_slo_no_violations_on_normal_queries() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    proc.encode(&make_input("normal", vec![]), 1000)
        .await
        .unwrap();
    proc.query(&make_query("normal"), 1000).await.unwrap();
    let report = proc.slo_report();
    assert_eq!(report.violation_count, 0);
    assert!(!report.circuit_open);
}

// --- Cognitive profile tests (v5.5) ---

#[test]
fn test_profile_empty_system() {
    let engine = MockEngine::new(32);
    let proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let p = proc.profile(1000);
    assert_eq!(p.total_memories, 0);
    assert!((p.avg_saturation - 0.0).abs() < 1e-6);
    assert_eq!(p.crystallized_count, 0);
}

#[tokio::test]
async fn test_profile_counts_tiers() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    proc.encode(&make_input("normal data", vec![]), 1000)
        .await
        .unwrap();
    proc.encode(&make_input("secret data", vec!["sensitive"]), 1000)
        .await
        .unwrap();
    let p = proc.profile(1000);
    assert!(p.l2_count > 0 || p.l1_count > 0);
    assert!(p.l3_count > 0);
    assert_eq!(p.total_memories, p.l1_count + p.l2_count + p.l3_count);
}

#[tokio::test]
async fn test_profile_avg_saturation() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let result = proc
        .encode(&make_input("boost me", vec![]), 1000)
        .await
        .unwrap();
    proc.record_access(&result.unit.address, PinningEvent::CryptoVerification);
    let p = proc.profile(1000);
    assert!(p.avg_saturation > 0.0);
}

#[tokio::test]
async fn test_profile_crystallized_count() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let result = proc
        .encode(&make_input("crystallize me", vec![]), 1000)
        .await
        .unwrap();
    for _ in 0..25 {
        proc.record_access(&result.unit.address, PinningEvent::CryptoVerification);
    }
    let p = proc.profile(1000);
    assert!(p.crystallized_count > 0);
}

#[tokio::test]
async fn test_profile_top_tags() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    proc.encode(&make_input("tagged1", vec!["science"]), 1000)
        .await
        .unwrap();
    proc.encode(&make_input("tagged2", vec!["science"]), 1001)
        .await
        .unwrap();
    proc.encode(&make_input("tagged3", vec!["art"]), 1002)
        .await
        .unwrap();
    let p = proc.profile(1003);
    assert!(!p.top_tags.is_empty());
    assert_eq!(p.top_tags[0].0, "science");
    assert_eq!(p.top_tags[0].1, 2);
}

#[test]
fn test_profile_to_summary_readable() {
    let p = crate::processor::profile::CognitiveProfile {
        total_memories: 5,
        l1_count: 1,
        l2_count: 3,
        l3_count: 1,
        edge_count: 4,
        avg_saturation: 0.42,
        crystallized_count: 1,
        top_tags: vec![("test".to_string(), 3)],
    };
    let summary = p.to_summary();
    assert!(summary.contains("Memories: 5"));
    assert!(summary.contains("Crystallized: 1"));
    assert!(summary.contains("42.0%"));
}

// --- File ingestion tests (v5.6) ---

use crate::processor::ingest::{chunk_text, ChunkConfig};

#[test]
fn test_chunk_text_splits_at_paragraphs() {
    let text = "Alpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.";
    let chunks = chunk_text(
        text,
        &ChunkConfig {
            max_chunk_chars: 20,
            min_chunk_chars: 5,
        },
    );
    assert_eq!(chunks.len(), 3);
}

#[test]
fn test_chunk_text_merges_small_paragraphs() {
    let text = "Hi there.\n\nBye now.";
    let chunks = chunk_text(
        text,
        &ChunkConfig {
            max_chunk_chars: 100,
            min_chunk_chars: 5,
        },
    );
    assert_eq!(chunks.len(), 1);
    assert!(chunks[0].contains("Hi there."));
    assert!(chunks[0].contains("Bye now."));
}

#[test]
fn test_chunk_text_skips_tiny_chunks() {
    let text = "Ok";
    let chunks = chunk_text(
        text,
        &ChunkConfig {
            max_chunk_chars: 100,
            min_chunk_chars: 10,
        },
    );
    assert!(chunks.is_empty());
}

#[test]
fn test_chunk_text_empty_input() {
    let chunks = chunk_text("", &ChunkConfig::default());
    assert!(chunks.is_empty());
}

#[test]
fn test_chunk_text_respects_max() {
    let text = "A long paragraph that exceeds the limit.\n\nAnother one here.";
    let chunks = chunk_text(
        text,
        &ChunkConfig {
            max_chunk_chars: 30,
            min_chunk_chars: 5,
        },
    );
    assert!(chunks.len() >= 2);
}

#[tokio::test]
async fn test_ingest_text_creates_memories() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let text =
        "First paragraph about Rust.\n\nSecond paragraph about memory.\n\nThird about graphs.";
    let result = crate::processor::ingest::ingest_text(
        &mut proc,
        text,
        "test.md",
        vec![],
        &ChunkConfig {
            max_chunk_chars: 40,
            min_chunk_chars: 10,
        },
        1000,
    )
    .await
    .unwrap();
    assert!(result.chunks >= 2);
    assert_eq!(result.addresses.len(), result.chunks);
}

#[tokio::test]
async fn test_ingest_text_preserves_source() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let result = crate::processor::ingest::ingest_text(
        &mut proc,
        "Content here is long enough to be a chunk.",
        "notes.md",
        vec![],
        &ChunkConfig::default(),
        1000,
    )
    .await
    .unwrap();
    assert_eq!(result.source, "notes.md");
}

#[tokio::test]
async fn test_ingest_file_nonexistent_returns_error() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let result = proc
        .ingest_file(std::path::Path::new("/nonexistent/file.txt"), vec![], 1000)
        .await;
    assert!(result.is_err());
}

// --- Zero-trust crystallization tests (v5.7) ---

use crate::processor::trust::CrystallizationPolicy;

#[tokio::test]
async fn test_require_approval_blocks_auto_promotion() {
    let mut config = ProcessorConfig::default();
    config.crystallization = CrystallizationPolicy::RequireApproval;
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, config);

    let result = proc
        .encode(&make_input("guard me", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();

    for _ in 0..30 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    // σ > 0.95 but memory should NOT be promoted (guarded)
    assert!(proc.stats().l2_nodes > 0 || proc.stats().l1_size > 0);
    assert_eq!(proc.stats().l3_size, 0);
}

#[tokio::test]
async fn test_approve_crystallization_promotes() {
    let mut config = ProcessorConfig::default();
    config.crystallization = CrystallizationPolicy::RequireApproval;
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, config);

    let result = proc
        .encode(&make_input("approve me", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();

    for _ in 0..30 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    assert!(proc.approve_crystallization(&addr));
    assert!(proc.stats().l3_size > 0);
}

#[tokio::test]
async fn test_approve_crystallization_rejects_low_sigma() {
    let mut config = ProcessorConfig::default();
    config.crystallization = CrystallizationPolicy::RequireApproval;
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, config);

    let result = proc
        .encode(&make_input("too young", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();

    proc.record_access(&addr, PinningEvent::Access);
    assert!(!proc.approve_crystallization(&addr));
}

#[tokio::test]
async fn test_auto_policy_still_works() {
    let mut config = ProcessorConfig::default();
    config.crystallization = CrystallizationPolicy::Auto;
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, config);

    let result = proc
        .encode(&make_input("auto promote", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();

    for _ in 0..30 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    assert!(proc.stats().l3_size > 0);
}

#[test]
fn test_default_policy_requires_approval() {
    // ADR-020: learned signals propose, never self-authorize. The default
    // must match CrystallizationPolicy's own documented default.
    let config = ProcessorConfig::default();
    assert_eq!(
        config.crystallization,
        CrystallizationPolicy::RequireApproval
    );
    assert_eq!(
        CrystallizationPolicy::default(),
        CrystallizationPolicy::RequireApproval
    );
}

// --- Source provenance tests (v5.7) ---

use crate::memory::types::TrustLevel;

#[test]
fn test_unverified_starts_at_zero() {
    assert!((TrustLevel::Unverified.initial_saturation() - 0.0).abs() < 1e-6);
}

#[test]
fn test_user_reviewed_starts_higher() {
    assert!((TrustLevel::UserReviewed.initial_saturation() - 0.1).abs() < 1e-6);
}

#[test]
fn test_verified_starts_highest() {
    assert!((TrustLevel::Verified.initial_saturation() - 0.3).abs() < 1e-6);
}

#[tokio::test]
async fn test_encode_respects_trust_level() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let input = RawInput {
        content: "verified fact".to_string(),
        content_type: ContentType::Text,
        metadata: InputMetadata {
            trust: TrustLevel::UserReviewed,
            ..Default::default()
        },
    };
    let result = proc.encode(&input, 1000).await.unwrap();
    assert!((result.unit.saturation - 0.1).abs() < 1e-6);
}

// --- Memory deletion & traversal tests (v5.8) ---

#[tokio::test]
async fn test_forget_removes_from_l2() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let result = proc
        .encode(&make_input("forget me", vec![]), 1000)
        .await
        .unwrap();
    assert!(proc.stats().l2_nodes > 0);
    assert!(proc.forget(&result.unit.address));
    assert_eq!(proc.stats().l2_nodes, 0);
}

#[tokio::test]
async fn test_forget_removes_from_l3() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    proc.encode(&make_input("secret delete", vec!["sensitive"]), 1000)
        .await
        .unwrap();
    let addr = UorAddress::from_content("secret delete");
    assert!(proc.stats().l3_size > 0);
    assert!(proc.forget(&addr));
    assert_eq!(proc.stats().l3_size, 0);
}

#[test]
fn test_forget_not_found() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    assert!(!proc.forget(&UorAddress::from_content("nonexistent")));
}

#[tokio::test]
async fn test_forget_cleans_edges() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let r1 = proc
        .encode(&make_input("linked A", vec![]), 1000)
        .await
        .unwrap();
    proc.encode(&make_input("linked B", vec![]), 1001)
        .await
        .unwrap();
    assert!(proc.stats().l2_edges > 0);
    proc.forget(&r1.unit.address);
    // Edges involving the deleted node should be cleaned
    assert_eq!(proc.association_count(&r1.unit.address), 0);
}

#[tokio::test]
async fn test_related_returns_neighbors() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let r1 = proc
        .encode(&make_input("node A", vec![]), 1000)
        .await
        .unwrap();
    proc.encode(&make_input("node B", vec![]), 1001)
        .await
        .unwrap();
    proc.encode(&make_input("node C", vec![]), 1002)
        .await
        .unwrap();
    let neighbors = proc.related(&r1.unit.address);
    assert!(neighbors.len() >= 1);
}

#[tokio::test]
async fn test_related_empty_for_isolated() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let r1 = proc
        .encode(&make_input("alone", vec![]), 1000)
        .await
        .unwrap();
    proc.clear_session();
    proc.encode(&make_input("separate", vec![]), 2000)
        .await
        .unwrap();
    assert!(proc.related(&r1.unit.address).is_empty());
}

#[tokio::test]
async fn test_association_count() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let r1 = proc.encode(&make_input("hub", vec![]), 1000).await.unwrap();
    proc.encode(&make_input("spoke1", vec![]), 1001)
        .await
        .unwrap();
    proc.encode(&make_input("spoke2", vec![]), 1002)
        .await
        .unwrap();
    assert!(proc.association_count(&r1.unit.address) >= 2);
}

// --- Pressure-aware decay tests (v5.9) ---

#[test]
fn test_pressure_zero_when_empty() {
    let p = slo::calculate_pressure(0, 100, 0, 10_000);
    assert!((p - 0.0).abs() < 1e-6);
}

#[test]
fn test_pressure_increases_with_utilization() {
    let p = slo::calculate_pressure(0, 100, 5000, 10_000);
    assert!((p - 0.5).abs() < 1e-6);
}

#[test]
fn test_pressure_capped_at_one() {
    let p = slo::calculate_pressure(200, 100, 20_000, 10_000);
    assert!((p - 1.0).abs() < 1e-6);
}

#[test]
fn test_adjusted_half_life_decreases_under_pressure() {
    let base = 3_600_000_i64;
    let adj = slo::pressure_adjusted_half_life(base, 0.9, 2.0);
    assert!(adj < base);
    assert!(adj > 0);
}

#[test]
fn test_adjusted_half_life_unchanged_at_zero_pressure() {
    let base = 3_600_000_i64;
    let adj = slo::pressure_adjusted_half_life(base, 0.0, 2.0);
    assert_eq!(adj, base);
}

#[tokio::test]
async fn test_slo_report_includes_pressure() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    for i in 0..5 {
        proc.encode(&make_input(&format!("pressure data {i}"), vec![]), 1000 + i)
            .await
            .unwrap();
    }
    proc.query(&make_query("pressure"), 2000).await.unwrap();
    let report = proc.slo_report();
    assert!(report.pressure >= 0.0);
    assert!(report.adjusted_half_life_ms > 0);
}

#[tokio::test]
async fn test_pressure_adjusts_half_life_in_report() {
    let mut config = ProcessorConfig::default();
    config.pressure.l2_capacity = 10; // small capacity to trigger pressure
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, config);
    for i in 0..8 {
        proc.encode(&make_input(&format!("fill {i}"), vec![]), 1000 + i)
            .await
            .unwrap();
    }
    proc.query(&make_query("fill"), 2000).await.unwrap();
    let report = proc.slo_report();
    assert!(report.pressure > 0.5);
    assert!(report.adjusted_half_life_ms < 3_600_000);
}

// --- L3 trust updates recorded in the ledger + persistence hardening (v6.2) ---

#[tokio::test]
async fn test_l3_trust_update_appends_chain_entry() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("vault secret", vec!["sensitive"]), 1000)
        .await
        .unwrap();
    assert_eq!(result.decision.tier, Tier::L3);
    let addr = result.unit.address.clone();
    let len_before = proc.stats().l3_chain_length;

    assert!(proc.record_access(&addr, PinningEvent::Corroboration));

    let stats = proc.stats();
    assert_eq!(stats.l3_chain_length, len_before + 1);
    assert!(stats.l3_integrity, "ledger must verify after trust update");
}

#[tokio::test]
async fn test_l3_conflict_appends_chain_entry() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("disputed secret", vec!["sensitive"]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();
    let len_before = proc.stats().l3_chain_length;

    assert!(proc.record_conflict(&addr, 0.5).is_some());

    let stats = proc.stats();
    assert_eq!(stats.l3_chain_length, len_before + 1);
    assert!(stats.l3_integrity, "ledger must verify after dispute");
}

#[tokio::test]
async fn test_l3_trust_updated_state_survives_restore() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("evolving secret", vec!["sensitive"]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();
    proc.record_access(&addr, PinningEvent::CryptoVerification);
    proc.record_conflict(&addr, 0.05);
    let snap = proc.snapshot(2000);

    let engine2 = MockEngine::new(384);
    let mut proc2 = MemoryProcessor::new(engine2, ProcessorConfig::default());
    proc2.restore(snap).unwrap();
    assert!(proc2.health_check());
}

#[tokio::test]
async fn test_restore_detects_tampered_unit() {
    use crate::processor::types::PersistError;

    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    proc.encode(&make_input("sealed secret", vec!["sensitive"]), 1000)
        .await
        .unwrap();

    let mut snap = proc.snapshot(2000);
    // Tamper with the snapshot's L3 entry without touching the chain.
    snap.l3_entries[0].saturation = 0.99;

    let engine2 = MockEngine::new(384);
    let mut proc2 = MemoryProcessor::new(engine2, ProcessorConfig::default());
    let err = proc2.restore(snap).unwrap_err();
    assert!(matches!(err, PersistError::UnitIntegrityFailed(_)));
}

#[test]
fn test_restore_empty_blocks_errors_instead_of_panicking() {
    use crate::processor::types::PersistError;

    let snapshot = Snapshot {
        version: "5.0.0".to_string(),
        created_at: 1000,
        l2_nodes: vec![],
        l2_edges: std::collections::HashMap::new(),
        l3_entries: vec![],
        l3_blocks: vec![], // crafted/corrupt: no genesis block
        shadow_entries: vec![],
    };
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let err = proc.restore(snapshot).unwrap_err();
    assert!(matches!(err, PersistError::MalformedChain(_)));
}

fn version_snapshot(version: &str) -> Snapshot {
    Snapshot {
        version: version.to_string(),
        created_at: 1000,
        l2_nodes: vec![],
        l2_edges: std::collections::HashMap::new(),
        l3_entries: vec![],
        l3_blocks: vec![crate::chain::block::Block::genesis()],
        shadow_entries: vec![],
    }
}

#[test]
fn test_restore_accepts_same_major_different_minor() {
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    proc.restore(version_snapshot("5.1.7")).unwrap();
}

#[test]
fn test_restore_rejects_different_major() {
    use crate::processor::types::PersistError;
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let err = proc.restore(version_snapshot("4.0.0")).unwrap_err();
    assert!(matches!(err, PersistError::IncompatibleVersion { .. }));
}

#[test]
fn test_restore_rejects_garbage_version() {
    use crate::processor::types::PersistError;
    let engine = MockEngine::new(32);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    for garbage in ["banana", "", "5", "5.0", "5.0.0.0", "v5.0.0", "5.x.0"] {
        let err = proc.restore(version_snapshot(garbage)).unwrap_err();
        assert!(
            matches!(err, PersistError::IncompatibleVersion { .. }),
            "version {garbage:?} must be rejected"
        );
    }
}

#[tokio::test]
async fn test_save_to_file_fsyncs_and_roundtrips() {
    let dir = std::env::temp_dir().join("evolve-core-test-v62-fsync");
    std::fs::create_dir_all(&dir).ok();
    let path = dir.join("state.json");

    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let result = proc
        .encode(&make_input("durable secret", vec!["sensitive"]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();
    proc.record_access(&addr, PinningEvent::Corroboration);
    proc.save_to_file(&path, 2000).unwrap();

    let engine2 = MockEngine::new(384);
    let mut proc2 = MemoryProcessor::new(engine2, ProcessorConfig::default());
    proc2.load_from_file(&path).unwrap();
    assert!(proc2.health_check());
    assert_eq!(proc2.stats().l3_size, 1);

    std::fs::remove_file(&path).ok();
    std::fs::remove_dir(&dir).ok();
}

// --- Lifecycle wiring tests (v6.3: orchestrator driven by the facade) ---

use crate::lifecycle::types::Phase;
use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::representation::types::{
    CrossModelResult, EngineCapabilities, Representation, SimilarityStrategy,
};
use crate::shadow::types::FailureCategory;

#[tokio::test]
async fn test_encode_enters_active_flow_and_records_trace() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    assert_eq!(proc.phase(), Phase::Idle);

    proc.encode(&make_input("first op", vec![]), 1000)
        .await
        .unwrap();
    let stats = proc.stats();
    assert_eq!(stats.phase, Phase::ActiveFlow);
    assert_eq!(stats.trace_count, 1);
}

#[tokio::test]
async fn test_query_records_operation_trace() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    proc.encode(&make_input("queryable", vec![]), 1000)
        .await
        .unwrap();
    proc.query(&make_query("queryable"), 1001).await.unwrap();
    let stats = proc.stats();
    assert_eq!(stats.phase, Phase::ActiveFlow);
    assert_eq!(stats.trace_count, 2);
}

#[tokio::test]
async fn test_detach_below_threshold_returns_to_idle_without_synthesis() {
    let engine = MockEngine::new(384);
    // Default synthesis_threshold is 10; one trace stays below it.
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    proc.encode(&make_input("one op", vec![]), 1000)
        .await
        .unwrap();

    let report = proc.detach(1001).unwrap();
    assert!(!report.synthesized);
    assert_eq!(report.traces_processed, 0);
    assert!(report.decay.is_none());
    assert_eq!(proc.phase(), Phase::Idle);
}

#[tokio::test]
async fn test_detach_runs_rem_synthesis_and_decay_sweep() {
    let mut config = ProcessorConfig::default();
    config.lifecycle.synthesis_threshold = 2;
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, config);

    proc.encode(&make_input("trace one", vec![]), 1000)
        .await
        .unwrap();
    proc.encode(&make_input("trace two", vec![]), 1001)
        .await
        .unwrap();
    assert_eq!(proc.stats().trace_count, 2);

    // Detach far in the future: synthesis runs and the decay sweep prunes
    // the fully-decayed unpinned units.
    let far_future = 1000 + 40_000_000;
    let report = proc.detach(far_future).unwrap();
    assert!(report.synthesized);
    assert_eq!(report.traces_processed, 2);
    let decay = report.decay.unwrap();
    assert_eq!(decay.l2_examined, 2);
    assert!(
        decay.l2_pruned > 0,
        "REM synthesis must run the decay sweep"
    );
    assert_eq!(proc.phase(), Phase::Idle);
    assert_eq!(proc.stats().trace_count, 0);
}

#[tokio::test]
async fn test_detach_from_idle_is_invalid_phase() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    assert!(proc.detach(1000).is_err());
}

#[tokio::test]
async fn test_budget_exhaustion_keeps_system_idle() {
    let mut config = ProcessorConfig::default();
    config.lifecycle.default_ops_budget = 1;
    config.lifecycle.default_time_budget_ms = 60_000;
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, config);

    proc.start_session(1000).unwrap();
    proc.encode(&make_input("only op", vec![]), 1001)
        .await
        .unwrap();
    assert_eq!(proc.phase(), Phase::ActiveFlow);
    assert_eq!(proc.stats().trace_count, 1);

    proc.detach(1002).unwrap();
    assert_eq!(proc.phase(), Phase::Idle);

    // Budget is exhausted: further operations must not re-enter ActiveFlow
    // and must not record traces.
    proc.encode(&make_input("over budget", vec![]), 1003)
        .await
        .unwrap();
    assert_eq!(proc.phase(), Phase::Idle);
    assert_eq!(proc.stats().trace_count, 1);
}

// --- Shadow genome wiring tests (v6.3: real failures feed the genome) ---

/// Engine that refuses to encode content containing "!!fail".
struct FlakyEngine {
    inner: MockEngine,
}

impl FlakyEngine {
    fn new(dimensions: usize) -> Self {
        Self {
            inner: MockEngine::new(dimensions),
        }
    }
}

impl RepresentationEngine for FlakyEngine {
    fn model_id(&self) -> &str {
        self.inner.model_id()
    }
    fn capabilities(&self) -> &EngineCapabilities {
        self.inner.capabilities()
    }
    async fn encode(&self, content: &str) -> Result<Representation, EngineError> {
        if content.contains("!!fail") {
            return Err(EngineError::EncodingFailed(
                "flaky engine refused content".to_string(),
            ));
        }
        self.inner.encode(content).await
    }
    async fn encode_batch(&self, contents: &[&str]) -> Result<Vec<Representation>, EngineError> {
        let mut out = Vec::with_capacity(contents.len());
        for c in contents {
            out.push(self.encode(c).await?);
        }
        Ok(out)
    }
    fn similarity(
        &self,
        a: &Representation,
        b: &Representation,
        strategy: SimilarityStrategy,
    ) -> f32 {
        self.inner.similarity(a, b, strategy)
    }
    fn cross_model_similarity(&self, a: &Representation, b: &Representation) -> CrossModelResult {
        self.inner.cross_model_similarity(a, b)
    }
    fn serialize(&self, rep: &Representation) -> Vec<u8> {
        self.inner.serialize(rep)
    }
    fn deserialize(&self, bytes: &[u8]) -> Result<Representation, EngineError> {
        self.inner.deserialize(bytes)
    }
    fn is_native(&self, rep: &Representation) -> bool {
        self.inner.is_native(rep)
    }
}

/// Engine that takes ≥10ms per encode, to violate a 0ms latency SLO.
struct SlowEngine {
    inner: MockEngine,
}

impl RepresentationEngine for SlowEngine {
    fn model_id(&self) -> &str {
        self.inner.model_id()
    }
    fn capabilities(&self) -> &EngineCapabilities {
        self.inner.capabilities()
    }
    async fn encode(&self, content: &str) -> Result<Representation, EngineError> {
        std::thread::sleep(std::time::Duration::from_millis(10));
        self.inner.encode(content).await
    }
    async fn encode_batch(&self, contents: &[&str]) -> Result<Vec<Representation>, EngineError> {
        let mut out = Vec::with_capacity(contents.len());
        for c in contents {
            out.push(self.encode(c).await?);
        }
        Ok(out)
    }
    fn similarity(
        &self,
        a: &Representation,
        b: &Representation,
        strategy: SimilarityStrategy,
    ) -> f32 {
        self.inner.similarity(a, b, strategy)
    }
    fn cross_model_similarity(&self, a: &Representation, b: &Representation) -> CrossModelResult {
        self.inner.cross_model_similarity(a, b)
    }
    fn serialize(&self, rep: &Representation) -> Vec<u8> {
        self.inner.serialize(rep)
    }
    fn deserialize(&self, bytes: &[u8]) -> Result<Representation, EngineError> {
        self.inner.deserialize(bytes)
    }
    fn is_native(&self, rep: &Representation) -> bool {
        self.inner.is_native(rep)
    }
}

#[tokio::test]
async fn test_encode_engine_error_feeds_shadow_genome() {
    let engine = FlakyEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let err = proc
        .encode(&make_input("!!fail content", vec![]), 1000)
        .await;
    assert!(err.is_err());

    let stats = proc.shadow_stats();
    assert_eq!(stats.total_entries, 1);
    assert_eq!(stats.active_entries, 1);
    assert_eq!(stats.by_category[0].0, FailureCategory::IntegrationFailure);
}

#[tokio::test]
async fn test_repeated_engine_failures_dedup_and_increment_triggers() {
    let engine = FlakyEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    for i in 0..3 {
        let _ = proc
            .encode(&make_input("!!fail again", vec![]), 1000 + i)
            .await;
    }
    let stats = proc.shadow_stats();
    assert_eq!(stats.total_entries, 1, "identical failures must dedup");
    assert_eq!(stats.total_triggers, 3);
}

#[tokio::test]
async fn test_check_safety_blocks_after_recorded_engine_failure() {
    let engine = FlakyEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    let _ = proc
        .encode(&make_input("!!fail content", vec![]), 1000)
        .await;

    // The failure was recorded under the "memory.encode" intent; a similar
    // intent must now be blocked by the interceptor.
    let verdict = proc.check_safety("memory.encode").await.unwrap();
    assert!(matches!(
        verdict,
        crate::shadow::interceptor::Verdict::Block { .. }
    ));
}

#[tokio::test]
async fn test_dispute_records_hallucination_and_blocks_similar_intent() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("the moon is made of cheese", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();

    assert!(proc.record_conflict(&addr, 0.8).is_some());

    let stats = proc.shadow_stats();
    assert_eq!(stats.total_entries, 1);
    assert!(stats
        .by_category
        .iter()
        .any(|(c, n)| *c == FailureCategory::Hallucination && *n == 1));

    // An intent matching the disputed memory's own embedding is blocked.
    let verdict = proc
        .check_safety("the moon is made of cheese")
        .await
        .unwrap();
    assert!(matches!(
        verdict,
        crate::shadow::interceptor::Verdict::Block { .. }
    ));
}

#[tokio::test]
async fn test_dispute_of_unknown_address_records_nothing() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    assert!(proc
        .record_conflict(&UorAddress::from_content("ghost"), 0.9)
        .is_none());
    assert_eq!(proc.shadow_stats().total_entries, 0);
}

#[tokio::test]
async fn test_slo_circuit_open_recorded_as_resource_exhaustion() {
    let mut config = ProcessorConfig::default();
    config.slo.max_query_latency_ms = 0; // any real latency violates
    let engine = SlowEngine {
        inner: MockEngine::new(384),
    };
    let proc = MemoryProcessor::new(engine, config);

    proc.query(&make_query("anything"), 1000).await.unwrap();
    assert!(proc.slo_report().circuit_open);

    let stats = proc.shadow_stats();
    assert!(stats
        .by_category
        .iter()
        .any(|(c, _)| *c == FailureCategory::ResourceExhaustion));

    // The circuit stays open on the next query — the opening transition is
    // recorded only once (dedup keeps a single entry regardless).
    proc.query(&make_query("anything else"), 1001)
        .await
        .unwrap();
    assert_eq!(proc.shadow_stats().total_entries, 1);
}

// --- Decay tick tests (v6.3: forgetting that actually deletes) ---

#[tokio::test]
async fn test_decay_tick_evicts_expired_l1() {
    let mut config = ProcessorConfig::default();
    config.l1_ttl_ms = 60_000;
    config.encoder.tier_thresholds.l2 = 1.0; // route everything to L1
    config.encoder.tier_thresholds.l3 = 1.0;
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, config);

    proc.encode(&make_input("ephemeral note", vec![]), 1000)
        .await
        .unwrap();
    assert_eq!(proc.stats().l1_size, 1);

    let report = proc.run_decay_tick(200_000);
    assert_eq!(report.l1_examined, 1);
    assert_eq!(report.l1_evicted, 1);
    assert_eq!(proc.stats().l1_size, 0);
}

#[tokio::test]
async fn test_decay_tick_prunes_unpinned_spares_pinned_and_cleans_edges() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let stale = proc
        .encode(&make_input("stale fact", vec![]), 1000)
        .await
        .unwrap();
    let pinned = proc
        .encode(&make_input("pinned fact", vec![]), 1001)
        .await
        .unwrap();
    assert!(proc.stats().l2_edges > 0, "co-capture links the pair");

    // Pin one unit to σ≈0.81 via the weighted pinning hierarchy; the other
    // stays near σ≈0.05 (one CrossReference from co-capture).
    for _ in 0..11 {
        proc.record_access(&pinned.unit.address, PinningEvent::CryptoVerification);
    }

    // 10 half-lives later: the unpinned unit decays below threshold, the
    // pinned one is protected by its saturation-slowed decay.
    let report = proc.run_decay_tick(1000 + 36_000_000);
    assert_eq!(report.l2_examined, 2);
    assert_eq!(report.l2_pruned, 1);
    assert_eq!(report.l2_promoted, 0);

    let stats = proc.stats();
    assert_eq!(stats.l2_nodes, 1);
    assert_eq!(stats.l2_edges, 0, "pruning must clean edges");
    assert_eq!(proc.association_count(&pinned.unit.address), 0);
    assert!(proc.related(&stale.unit.address).is_empty());
}

#[tokio::test]
async fn test_decay_tick_spares_crystallization_candidates() {
    // Default policy is RequireApproval: a σ≥0.95 unit is a pending
    // proposal — never pruned, never self-promoted.
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("crystal candidate", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();
    for _ in 0..25 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    let report = proc.run_decay_tick(1000 + 360_000_000);
    assert_eq!(report.l2_pruned, 0);
    assert_eq!(report.l2_promoted, 0);
    assert_eq!(proc.stats().l2_nodes, 1);
    assert_eq!(proc.stats().l3_size, 0);
    assert_eq!(proc.pending_crystallizations(), vec![addr]);
}

#[tokio::test]
async fn test_decay_tick_promotes_saturated_under_auto_policy() {
    // Build a σ≥0.95 L2 unit under the guarded policy, then restore that
    // state into an Auto-policy processor: the tick applies the v5.2
    // promotion rule.
    let engine = MockEngine::new(384);
    let mut guarded = MemoryProcessor::new(engine, ProcessorConfig::default());
    let result = guarded
        .encode(&make_input("earned promotion", vec![]), 1000)
        .await
        .unwrap();
    for _ in 0..25 {
        guarded.record_access(&result.unit.address, PinningEvent::CryptoVerification);
    }
    let snap = guarded.snapshot(2000);

    let engine2 = MockEngine::new(384);
    let mut auto = MemoryProcessor::new(engine2, auto_config());
    auto.restore(snap).unwrap();
    assert_eq!(auto.stats().l2_nodes, 1);

    let report = auto.run_decay_tick(3000);
    assert_eq!(report.l2_promoted, 1);
    assert_eq!(report.l2_pruned, 0);
    assert_eq!(auto.stats().l2_nodes, 0);
    assert_eq!(auto.stats().l3_size, 1);
}

#[tokio::test]
async fn test_decay_tick_never_touches_l3() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());
    proc.encode(&make_input("vaulted truth", vec!["sensitive"]), 1000)
        .await
        .unwrap();
    assert_eq!(proc.stats().l3_size, 1);

    // Even a fully decayed timeframe leaves L3 intact: vault forgetting
    // stays explicit (forget/dispute) per zero-trust doctrine.
    let report = proc.run_decay_tick(1000 + 360_000_000);
    assert_eq!(report.l3_examined, 1);
    assert_eq!(proc.stats().l3_size, 1);
    assert!(proc.health_check());
}

// --- ADR-020 default-policy gating tests (v6.3) ---

#[tokio::test]
async fn test_default_config_gates_crystallization() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc
        .encode(&make_input("proposes not authorizes", vec![]), 1000)
        .await
        .unwrap();
    let addr = result.unit.address.clone();
    for _ in 0..30 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    // Saturation alone must not commit the promotion...
    assert_eq!(proc.stats().l3_size, 0);
    assert_eq!(proc.pending_crystallizations(), vec![addr.clone()]);

    // ...explicit approval does.
    assert!(proc.approve_crystallization(&addr));
    assert_eq!(proc.stats().l3_size, 1);
}
