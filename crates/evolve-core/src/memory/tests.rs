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

fn make_unit_with_embedding(content: &str, embedding: Vec<f32>, last_accessed: i64, saturation: f32) -> MemoryUnit {
    MemoryUnit {
        address: UorAddress::from_content(content),
        embedding,
        created_at: 0,
        last_accessed,
        access_count: 0,
        saturation,
        metadata: UnitMetadata::default(),
    }
}

// --- Encoder tests ---

#[tokio::test]
async fn test_encode_produces_valid_unit() {
    let engine = MockEngine::new(32);
    let input = make_raw_input("hello world", vec![]);
    let config = EncoderConfig::default();
    let unit = encoder::encode(&input, &engine, &config, 1000).await.unwrap();
    assert_eq!(unit.embedding.len(), 32);
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

#[tokio::test]
async fn test_encode_produces_content_address() {
    let engine = MockEngine::new(32);
    let input = make_raw_input("deterministic content", vec![]);
    let config = EncoderConfig::default();
    let unit = encoder::encode(&input, &engine, &config, 1000).await.unwrap();
    let expected = UorAddress::from_content("deterministic content");
    assert_eq!(unit.address, expected);
}

// --- UorAddress tests ---

#[test]
fn test_uor_address_from_content() {
    let addr = UorAddress::from_content("hello");
    assert_eq!(addr.as_str().len(), 64);
}

#[test]
fn test_uor_address_deduplicates() {
    let a1 = UorAddress::from_content("same content");
    let a2 = UorAddress::from_content("same content");
    assert_eq!(a1, a2);
}

#[test]
fn test_uor_address_different_content() {
    let a1 = UorAddress::from_content("alpha");
    let a2 = UorAddress::from_content("beta");
    assert_ne!(a1, a2);
}

// --- Decoder tests ---

#[test]
fn test_decode_ranks_by_relevance() {
    let u1 = make_unit_with_embedding("a", vec![1.0, 0.0, 0.0], 1000, 0.0);
    let u2 = make_unit_with_embedding("b", vec![0.5, 0.5, 0.0], 1000, 0.0);
    let query_emb = vec![1.0, 0.0, 0.0];
    let config = DecoderConfig { top_k: 10, decay_threshold: 0.01, half_life_ms: 3_600_000 };
    let results = decoder::decode(&[&u1, &u2], &query_emb, 1000, &config);
    assert_eq!(results.len(), 2);
    assert!(results[0].relevance_score >= results[1].relevance_score);
}

#[test]
fn test_decode_filters_decayed() {
    let u = make_unit_with_embedding("c", vec![1.0, 0.0], 0, 0.0);
    let query_emb = vec![1.0, 0.0];
    let config = DecoderConfig { top_k: 10, decay_threshold: 0.5, half_life_ms: 1000 };
    // At now=5000, 5 half-lives passed: unsaturated memory decays fully
    let results = decoder::decode(&[&u], &query_emb, 5000, &config);
    assert!(results.is_empty());
}

#[test]
fn test_decode_respects_top_k() {
    let units: Vec<MemoryUnit> = (0..20)
        .map(|i| make_unit_with_embedding(&format!("u{i}"), vec![i as f32, 1.0], 1000, 0.0))
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

// --- Decay tests (thermodynamic model) ---

#[test]
fn test_decay_no_time_elapsed() {
    let result = calculate_decay(1000, 1000, 60000, 0.0);
    assert!((result - 1.0).abs() < 1e-6);
}

#[test]
fn test_decay_one_half_life_unsaturated() {
    // σ=0: T_ctx = ln(2), λ_eff = λ_base * ln(2) = ln(2)^2 / half_life
    // At exactly one half-life: decay = e^(-λ_eff * half_life) = e^(-ln(2)^2)
    let result = calculate_decay(0, 60000, 60000, 0.0);
    let expected = (-std::f32::consts::LN_2 * std::f32::consts::LN_2).exp();
    assert!((result - expected).abs() < 1e-4);
    assert!(result < 1.0);
    assert!(result > 0.0);
}

#[test]
fn test_decay_negative_elapsed() {
    let result = calculate_decay(2000, 1000, 60000, 0.5);
    assert!((result - 1.0).abs() < 1e-6);
}

#[test]
fn test_temperature_at_zero_saturation() {
    let t = temperature(0.0);
    assert!((t - std::f32::consts::LN_2).abs() < 1e-6);
}

#[test]
fn test_temperature_at_full_saturation() {
    let t = temperature(1.0);
    assert!(t.abs() < 1e-6);
}

#[test]
fn test_decay_saturated_memory_no_decay() {
    // σ=1: T_ctx = 0, λ_eff = 0, decay = e^0 = 1.0 regardless of time
    let result = calculate_decay(0, 1_000_000, 1000, 1.0);
    assert!((result - 1.0).abs() < 1e-6);
}

#[test]
fn test_decay_unsaturated_memory_decays() {
    // σ=0 should decay over time
    let result = calculate_decay(0, 100_000, 1000, 0.0);
    assert!(result < 0.01);
}

#[test]
fn test_decay_half_saturated_moderate() {
    let full_decay = calculate_decay(0, 60000, 60000, 0.0);
    let half_decay = calculate_decay(0, 60000, 60000, 0.5);
    // Half-saturated should decay slower than unsaturated
    assert!(half_decay > full_decay);
}

#[test]
fn test_effective_lambda_zero_at_saturation() {
    let base = std::f32::consts::LN_2 / 60000.0;
    let lambda = effective_lambda(base, 1.0);
    assert!(lambda.abs() < 1e-10);
}

#[test]
fn test_boost_saturation_increases() {
    let boosted = boost_saturation(0.0, 10, 0.1);
    assert!(boosted > 0.0);
    assert!(boosted < 1.0);
}

#[test]
fn test_boost_saturation_asymptotic() {
    let boosted = boost_saturation(0.5, 1000, 1.0);
    assert!((boosted - 1.0).abs() < 1e-4);
}

#[test]
fn test_should_prune_below_threshold() {
    assert!(should_prune(0.01, 0.05));
}

#[test]
fn test_should_not_prune_above_threshold() {
    assert!(!should_prune(0.5, 0.05));
}

// --- Weighted pinning tests (v5.1) ---

#[test]
fn test_pin_weight_ordering() {
    let a = pin_weight(PinningEvent::Access);
    let xr = pin_weight(PinningEvent::CrossReference);
    let co = pin_weight(PinningEvent::Corroboration);
    let cv = pin_weight(PinningEvent::CryptoVerification);
    assert!(cv > xr);
    assert_eq!(xr, co);
    assert!(xr > a);
}

#[test]
fn test_crypto_verification_pins_faster_than_access() {
    let mut sa = 0.0_f32;
    for _ in 0..10 {
        sa = boost_saturation_weighted(sa, PinningEvent::Access);
    }
    let mut sv = 0.0_f32;
    for _ in 0..2 {
        sv = boost_saturation_weighted(sv, PinningEvent::CryptoVerification);
    }
    assert!(sv > sa);
}

#[test]
fn test_cross_reference_pins_at_medium_weight() {
    let mut sa = 0.0_f32;
    let mut sx = 0.0_f32;
    for _ in 0..5 {
        sa = boost_saturation_weighted(sa, PinningEvent::Access);
        sx = boost_saturation_weighted(sx, PinningEvent::CrossReference);
    }
    assert!(sx > sa);
}

#[test]
fn test_boost_weighted_never_exceeds_one() {
    let mut s = 0.0_f32;
    for _ in 0..1000 {
        s = boost_saturation_weighted(s, PinningEvent::CryptoVerification);
    }
    assert!(s <= 1.0);
    assert!((s - 1.0).abs() < 1e-6);
}

// --- Entropy injection tests (v5.1) ---

#[test]
fn test_inject_entropy_reduces_saturation() {
    let result = inject_entropy(0.8, 0.3);
    assert!((result - 0.5).abs() < 1e-6);
}

#[test]
fn test_inject_entropy_clamps_to_zero() {
    let result = inject_entropy(0.2, 0.5);
    assert!((result - 0.0).abs() < 1e-6);
}

#[test]
fn test_inject_entropy_zero_severity_no_change() {
    let result = inject_entropy(0.8, 0.0);
    assert!((result - 0.8).abs() < 1e-6);
}

#[test]
fn test_entropy_spikes_temperature() {
    let old_t = temperature(0.8);
    let new_sigma = inject_entropy(0.8, 0.3);
    let new_t = temperature(new_sigma);
    assert!(new_t > old_t);
}

#[test]
fn test_entropy_accelerates_decay() {
    let high_sat = calculate_decay(0, 60000, 60000, 0.8);
    let low_sat = calculate_decay(0, 60000, 60000, inject_entropy(0.8, 0.5));
    assert!(low_sat < high_sat);
}
