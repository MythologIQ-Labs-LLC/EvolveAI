use crate::memory::types::*;
use crate::processor::facade::{MemoryProcessor, ProcessorConfig};
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
