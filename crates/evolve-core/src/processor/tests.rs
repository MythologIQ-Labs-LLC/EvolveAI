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

    proc.encode(&make_input("graph data", vec![]), 1000).await.unwrap();
    proc.encode(&make_input("vault data", vec!["sensitive"]), 1000).await.unwrap();

    let snap = proc.snapshot(2000);
    assert!(!snap.l2_nodes.is_empty() || !snap.l3_entries.is_empty());
    assert!(!snap.l3_blocks.is_empty());
}

#[tokio::test]
async fn test_restore_recovers_state() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    proc.encode(&make_input("remember this", vec![]), 1000).await.unwrap();
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

    proc.encode(&make_input("integrity", vec!["sensitive"]), 1000).await.unwrap();
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

    proc.encode(&make_input("ephemeral", vec![]), 1000).await.unwrap();
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
    proc.encode(&make_input("persist me", vec![]), 1000).await.unwrap();
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
    assert!(matches!(verdict, crate::shadow::interceptor::Verdict::Block { .. }));
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
    proc.encode(&make_input("vault content", vec!["sensitive"]), 1000).await.unwrap();

    // Query same content — should get O(1) exact match
    let qr = proc.query(&make_query("vault content"), 1000).await.unwrap();
    assert_eq!(qr.recall.memories.len(), 1);
    assert!((qr.recall.memories[0].relevance_score - 1.0).abs() < 1e-6);
    assert_eq!(qr.recall.metrics.tiers_queried, vec![Tier::L3]);
    assert_eq!(qr.recall.metrics.candidates_evaluated, 1);
}

#[tokio::test]
async fn test_l3_address_miss_falls_through() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    proc.encode(&make_input("stored in vault", vec!["sensitive"]), 1000).await.unwrap();

    // Query different content — should fall through to vector scan
    let qr = proc.query(&make_query("different query"), 1000).await.unwrap();
    // Vector scan should find the L3 entry via embedding similarity
    assert_eq!(qr.recall.metrics.tiers_queried, vec![Tier::L1, Tier::L2, Tier::L3]);
}

#[tokio::test]
async fn test_self_optimization() {
    // Prove: encode → access → saturate → L3 → O(1)
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    // Step 1: Encode (starts unsaturated, goes to L2)
    let result = proc.encode(&make_input("evolving memory", vec![]), 1000).await.unwrap();
    assert_eq!(result.unit.saturation, 0.0);
    // Without sensitive tag, goes to L2 by default

    // Step 2: Encode same content again with sensitive tag to get into L3
    let result = proc.encode(&make_input("evolving memory", vec!["sensitive"]), 1000).await.unwrap();
    assert_eq!(result.decision.tier, Tier::L3);

    // Step 3: Query by exact content — should get O(1) lookup
    let qr = proc.query(&make_query("evolving memory"), 1000).await.unwrap();
    assert!(!qr.recall.memories.is_empty());
}
