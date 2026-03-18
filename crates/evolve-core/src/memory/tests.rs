use super::*;
use crate::memory::decoder::{self, DecoderConfig};
use crate::memory::encoder::{self, EncoderConfig};
use crate::representation::mock::MockEngine;

fn make_raw_input(content: &str, tags: Vec<&str>) -> RawInput {
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

fn make_unit_with_embedding(embedding: Vec<f32>, last_accessed: i64, decay: f32) -> MemoryUnit {
    MemoryUnit {
        uor_id: uuid::Uuid::new_v4(),
        embedding,
        content_hash: "test".into(),
        created_at: 0,
        last_accessed,
        access_count: 0,
        decay_factor: decay,
        metadata: UnitMetadata::default(),
    }
}

#[tokio::test]
async fn test_encode_produces_valid_unit() {
    let engine = MockEngine::new(32);
    let input = make_raw_input("hello world", vec![]);
    let config = EncoderConfig::default();
    let unit = encoder::encode(&input, &engine, &config, 1000).await.unwrap();
    assert_eq!(unit.embedding.len(), 32);
    assert!(!unit.content_hash.is_empty());
    assert_eq!(unit.created_at, 1000);
}

#[tokio::test]
async fn test_encode_sensitive_routes_to_l3() {
    let engine = MockEngine::new(384);
    let input = make_raw_input("secret data", vec!["sensitive"]);
    let config = EncoderConfig::default();
    let unit = encoder::encode(&input, &engine, &config, 1000).await.unwrap();
    assert_eq!(unit.metadata.tier, Tier::L3);
}

#[test]
fn test_decode_ranks_by_relevance() {
    let u1 = make_unit_with_embedding(vec![1.0, 0.0, 0.0], 1000, 1.0);
    let u2 = make_unit_with_embedding(vec![0.5, 0.5, 0.0], 1000, 1.0);
    let query_emb = vec![1.0, 0.0, 0.0];
    let config = DecoderConfig { top_k: 10, decay_threshold: 0.01, half_life_ms: 3_600_000 };
    let results = decoder::decode(&[&u1, &u2], &query_emb, 1000, &config);
    assert_eq!(results.len(), 2);
    assert!(results[0].relevance_score >= results[1].relevance_score);
}

#[test]
fn test_decode_filters_decayed() {
    let u = make_unit_with_embedding(vec![1.0, 0.0], 0, 1.0);
    let query_emb = vec![1.0, 0.0];
    let config = DecoderConfig { top_k: 10, decay_threshold: 0.5, half_life_ms: 1000 };
    // At now=5000, 5 half-lives passed: decay = 0.03125 < 0.5 threshold
    let results = decoder::decode(&[&u], &query_emb, 5000, &config);
    assert!(results.is_empty());
}

#[test]
fn test_decode_respects_top_k() {
    let units: Vec<MemoryUnit> = (0..20)
        .map(|i| make_unit_with_embedding(vec![i as f32, 1.0], 1000, 1.0))
        .collect();
    let refs: Vec<&MemoryUnit> = units.iter().collect();
    let query_emb = vec![1.0, 0.0];
    let config = DecoderConfig { top_k: 5, decay_threshold: 0.01, half_life_ms: 3_600_000 };
    let results = decoder::decode(&refs, &query_emb, 1000, &config);
    assert_eq!(results.len(), 5);
}

#[test]
fn test_decode_empty_candidates() {
    let query_emb = vec![1.0, 0.0];
    let config = DecoderConfig::default();
    let results = decoder::decode(&[], &query_emb, 1000, &config);
    assert!(results.is_empty());
}

#[test]
fn test_decay_no_time_elapsed() {
    let result = calculate_decay(1000, 1000, 60000, 1.0);
    assert!((result - 1.0).abs() < 1e-6);
}

#[test]
fn test_decay_one_half_life() {
    let result = calculate_decay(0, 60000, 60000, 1.0);
    assert!((result - 0.5).abs() < 1e-6);
}

#[test]
fn test_decay_two_half_lives() {
    let result = calculate_decay(0, 120_000, 60000, 1.0);
    assert!((result - 0.25).abs() < 1e-6);
}

#[test]
fn test_decay_negative_elapsed() {
    let result = calculate_decay(2000, 1000, 60000, 0.8);
    assert!((result - 0.8).abs() < 1e-6);
}

#[test]
fn test_decay_custom_base_factor() {
    let result = calculate_decay(0, 60000, 60000, 0.5);
    assert!((result - 0.25).abs() < 1e-6);
}

#[test]
fn test_should_prune_below_threshold() {
    assert!(should_prune(0.01, 0.05));
}

#[test]
fn test_should_not_prune_above_threshold() {
    assert!(!should_prune(0.5, 0.05));
}

#[test]
fn test_effective_strength_boost() {
    let result = effective_strength(0.5, 10, 0.1);
    // boost = 1.0 + min(10 * 0.1, 2.0) = 2.0
    // strength = min(0.5 * 2.0, 1.0) = 1.0
    assert!((result - 1.0).abs() < 1e-6);
}

#[test]
fn test_effective_strength_clamped() {
    let result = effective_strength(0.9, 100, 0.5);
    // boost capped at 3.0, but result clamped to 1.0
    assert!((result - 1.0).abs() < 1e-6);
}

#[test]
fn test_effective_strength_zero_access() {
    let result = effective_strength(0.5, 0, 0.1);
    // boost = 1.0, so result = 0.5
    assert!((result - 0.5).abs() < 1e-6);
}
