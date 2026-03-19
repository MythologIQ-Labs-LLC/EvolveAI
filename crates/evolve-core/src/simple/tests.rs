use super::*;

#[tokio::test]
async fn test_add_and_search() {
    let mut mem = SimpleMemory::new();
    mem.add("the sky is blue").await.unwrap();
    let results = mem.search("the sky is blue", 5).await.unwrap();
    assert_eq!(results.len(), 1);
}

#[tokio::test]
async fn test_add_returns_deterministic_address() {
    let mut mem = SimpleMemory::new();
    let a1 = mem.add("same content").await.unwrap();
    let a2 = UorAddress::from_content("same content");
    assert_eq!(a1, a2);
}

#[tokio::test]
async fn test_feedback_boosts_saturation() {
    let mut mem = SimpleMemory::new();
    let addr = mem.add("important fact").await.unwrap();
    assert!(mem.feedback(&addr, PinningEvent::CryptoVerification));
}

#[tokio::test]
async fn test_dispute_reduces_saturation() {
    let mut mem = SimpleMemory::new();
    let addr = mem.add("disputed claim").await.unwrap();
    mem.feedback(&addr, PinningEvent::CryptoVerification);
    assert!(mem.dispute(&addr, 0.1).is_some());
}

#[tokio::test]
async fn test_end_session_clears_linking() {
    let mut mem = SimpleMemory::new();
    mem.add("fact one").await.unwrap();
    mem.end_session();
    mem.add("fact two").await.unwrap();
    assert_eq!(mem.processor().stats().l2_edges, 0);
}

#[tokio::test]
async fn test_into_processor_gives_full_access() {
    let mem = SimpleMemory::new();
    let proc = mem.into_processor();
    assert!(proc.health_check());
}

#[tokio::test]
async fn test_add_tagged_routes_sensitive_to_l3() {
    let mut mem = SimpleMemory::new();
    mem.add_tagged("secret", vec!["sensitive".into()]).await.unwrap();
    assert!(mem.processor().stats().l3_size > 0);
}

#[tokio::test]
async fn test_search_empty_returns_empty() {
    let mem = SimpleMemory::new();
    let results = mem.search("anything", 10).await.unwrap();
    assert!(results.is_empty());
}

#[tokio::test]
async fn test_simple_add_file() {
    let dir = std::env::temp_dir().join("evolve-simple-test");
    std::fs::create_dir_all(&dir).ok();
    let path = dir.join("test_ingest.txt");
    std::fs::write(&path, "First paragraph here is long enough.\n\nSecond paragraph also long enough.").ok();
    let mut mem = SimpleMemory::new();
    let result = mem.add_file(&path).await.unwrap();
    assert!(result.chunks > 0);
    assert!(mem.processor().stats().l2_nodes > 0 || mem.processor().stats().l3_size > 0);
    std::fs::remove_file(&path).ok();
    std::fs::remove_dir(&dir).ok();
}

#[tokio::test]
async fn test_simple_profile() {
    let mut mem = SimpleMemory::new();
    mem.add("knowledge about rust").await.unwrap();
    mem.add_tagged("api key", vec!["sensitive".into()]).await.unwrap();
    let p = mem.profile();
    assert_eq!(p.total_memories, 2);
    assert!(p.to_summary().contains("Memories: 2"));
}

#[tokio::test]
async fn test_simple_slo_report() {
    let mut mem = SimpleMemory::new();
    mem.add("slo check").await.unwrap();
    mem.search("slo check", 5).await.unwrap();
    let report = mem.slo_report();
    assert!(report.total_samples > 0);
    assert!(!report.circuit_open);
}

#[tokio::test]
async fn test_co_capture_links_within_session() {
    let mut mem = SimpleMemory::new();
    mem.add("fact A").await.unwrap();
    mem.add("fact B").await.unwrap();
    assert!(mem.processor().stats().l2_edges > 0);
}
