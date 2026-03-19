//! Integration test: Zero-trust crystallization properties.

use evolve_core::memory::types::*;
use evolve_core::processor::facade::MemoryProcessor;
use evolve_core::processor::trust::CrystallizationPolicy;
use evolve_core::processor::types::ProcessorConfig;
use evolve_core::representation::mock::MockEngine;

fn input(content: &str, trust: TrustLevel) -> RawInput {
    RawInput {
        content: content.to_string(),
        content_type: ContentType::Text,
        metadata: InputMetadata { trust, ..Default::default() },
    }
}

fn guarded_config() -> ProcessorConfig {
    let mut c = ProcessorConfig::default();
    c.crystallization = CrystallizationPolicy::RequireApproval;
    c
}

#[tokio::test]
async fn test_unverified_content_requires_more_evidence() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, guarded_config());

    let unverified = proc.encode(&input("LLM says X", TrustLevel::Unverified), 1000).await.unwrap();
    let verified = proc.encode(&input("Proven fact Y", TrustLevel::Verified), 1001).await.unwrap();

    // Same number of access events
    for _ in 0..10 {
        proc.record_access(&unverified.unit.address, PinningEvent::CrossReference);
        proc.record_access(&verified.unit.address, PinningEvent::CrossReference);
    }

    // Query both to get current saturation
    let q1 = proc.query(&Query { content: "LLM says X".into(), constraints: QueryConstraints::default() }, 2000).await.unwrap();
    let q2 = proc.query(&Query { content: "Proven fact Y".into(), constraints: QueryConstraints::default() }, 2000).await.unwrap();

    let s1 = q1.recall.memories[0].unit.saturation;
    let s2 = q2.recall.memories[0].unit.saturation;

    // Verified source started at σ₀=0.3, so it's further along
    assert!(s2 > s1, "Verified source (σ₀=0.3) should saturate faster than Unverified (σ₀=0.0)");
}

#[tokio::test]
async fn test_crystallization_guard_prevents_hallucination_permanence() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, guarded_config());

    let result = proc.encode(&input("hallucinated fact", TrustLevel::Unverified), 1000).await.unwrap();
    let addr = result.unit.address.clone();

    // Even 100 CryptoVerification events cannot auto-promote
    for _ in 0..100 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    assert_eq!(proc.stats().l3_size, 0, "guarded: no auto-promotion");
    assert_eq!(proc.pending_crystallizations().len(), 1);

    // Only explicit approval crystallizes
    assert!(proc.approve_crystallization(&addr));
    assert_eq!(proc.stats().l3_size, 1);
}

#[tokio::test]
async fn test_disputed_memory_evaporates() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    let result = proc.encode(&input("wrong claim", TrustLevel::Unverified), 1000).await.unwrap();
    let addr = result.unit.address.clone();

    // Build up saturation
    for _ in 0..15 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    // Major dispute → σ drops drastically
    let new_sat = proc.record_conflict(&addr, 0.8).unwrap();
    assert!(new_sat < 0.2, "severe dispute should slash saturation");

    // With low σ and enough time, memory is prunable
    let weight = evolve_core::memory::decay::calculate_decay(1000, 500_000, 60_000, new_sat);
    assert!(evolve_core::memory::decay::should_prune(weight, 0.05), "disputed memory should be prunable");
}

#[tokio::test]
async fn test_forget_removes_crystallized_memory() {
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, ProcessorConfig::default());

    // Encode with sensitive tag → routes directly to L3
    let sensitive = RawInput {
        content: "top secret".to_string(),
        content_type: ContentType::Text,
        metadata: InputMetadata {
            tags: vec!["sensitive".into()],
            trust: TrustLevel::Verified,
            ..Default::default()
        },
    };
    proc.encode(&sensitive, 1000).await.unwrap();
    let addr = UorAddress::from_content("top secret");
    assert!(proc.stats().l3_size > 0);

    // Even permanent (λ=0) memories can be explicitly deleted
    assert!(proc.forget(&addr));
    assert_eq!(proc.stats().l3_size, 0, "forget should remove even L3 memories");
}
