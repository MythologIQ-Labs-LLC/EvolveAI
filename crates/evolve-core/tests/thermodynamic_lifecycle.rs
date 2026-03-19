//! Integration test: Complete thermodynamic lifecycle proof.
//! Validates every primitive from the UOR research draft in sequence.

use evolve_core::memory::types::*;
use evolve_core::processor::facade::MemoryProcessor;
use evolve_core::processor::trust::CrystallizationPolicy;
use evolve_core::processor::types::ProcessorConfig;
use evolve_core::representation::mock::MockEngine;

fn input(content: &str, tags: Vec<&str>, trust: TrustLevel) -> RawInput {
    RawInput {
        content: content.to_string(),
        content_type: ContentType::Text,
        metadata: InputMetadata {
            tags: tags.into_iter().map(String::from).collect(),
            trust,
            ..Default::default()
        },
    }
}

#[tokio::test]
async fn test_complete_thermodynamic_lifecycle() {
    // Setup: RequireApproval policy, small pressure capacity
    let mut config = ProcessorConfig::default();
    config.crystallization = CrystallizationPolicy::RequireApproval;
    config.pressure.l2_capacity = 100;
    let engine = MockEngine::new(384);
    let mut proc = MemoryProcessor::new(engine, config);

    // 1. Encode 3 memories in same session (Unverified, σ₀=0.0)
    let r1 = proc.encode(&input("Rust is memory safe", vec!["tech"], TrustLevel::Unverified), 1000).await.unwrap();
    let r2 = proc.encode(&input("Ownership prevents data races", vec!["tech"], TrustLevel::Unverified), 1001).await.unwrap();
    let _r3 = proc.encode(&input("Lifetimes enforce borrowing rules", vec!["tech"], TrustLevel::Unverified), 1002).await.unwrap();
    assert_eq!(r1.unit.saturation, 0.0); // Unverified starts at 0

    // 2. Co-capture edges created automatically
    assert!(proc.stats().l2_edges > 0, "co-capture should create edges");

    // 3. CrossReference pins boosted peers' σ
    let qr = proc.query(&Query { content: "Rust is memory safe".into(), constraints: QueryConstraints::default() }, 1003).await.unwrap();
    assert!(qr.recall.memories[0].unit.saturation > 0.0, "CrossReference should have pinned fibers");

    // 4. Boost σ toward crystallization via CryptoVerification
    let addr = r1.unit.address.clone();
    for _ in 0..30 {
        proc.record_access(&addr, PinningEvent::CryptoVerification);
    }

    // 5. RequireApproval: memory stays in L2 despite σ ≥ 0.95
    assert!(proc.stats().l3_size == 0, "guarded: should NOT auto-promote");
    assert!(!proc.pending_crystallizations().is_empty(), "should have pending");

    // 6. Approve crystallization → L3
    assert!(proc.approve_crystallization(&addr));
    assert!(proc.stats().l3_size > 0, "should be in L3 now");

    // 7. O(1) exact match
    let qr = proc.query(&Query { content: "Rust is memory safe".into(), constraints: QueryConstraints::default() }, 2000).await.unwrap();
    assert_eq!(qr.recall.metrics.tiers_queried, vec![Tier::L3]);
    assert_eq!(qr.recall.metrics.candidates_evaluated, 1);

    // 8. Dispute → entropy injection
    let new_sat = proc.record_conflict(&addr, 0.5).unwrap();
    assert!(new_sat < 0.95, "dispute should drop σ below crystallization");

    // 9. Profile reflects system state
    let profile = proc.profile(3000);
    assert_eq!(profile.total_memories, 3);
    assert!(!profile.top_tags.is_empty());
    assert_eq!(profile.top_tags[0].0, "tech");

    // 10. SLO report includes pressure
    let slo = proc.slo_report();
    assert!(slo.pressure >= 0.0);
    assert!(slo.adjusted_half_life_ms > 0);

    // 11. Graph traversal works
    let neighbors = proc.related(&r2.unit.address);
    assert!(!neighbors.is_empty(), "co-captured memories should be related");

    // 12. Forget works on L3
    assert!(proc.forget(&addr));
    assert_eq!(proc.stats().l3_size, 0);
}
