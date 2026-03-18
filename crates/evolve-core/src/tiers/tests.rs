use super::*;
use crate::memory::types::{MemoryUnit, Tier, UnitMetadata};
use uuid::Uuid;

fn make_unit(tags: Vec<&str>, embedding_len: usize) -> MemoryUnit {
    MemoryUnit {
        uor_id: Uuid::new_v4(),
        embedding: vec![0.0; embedding_len],
        content_hash: "test-hash".into(),
        created_at: 1000,
        last_accessed: 1000,
        access_count: 0,
        decay_factor: 1.0,
        metadata: UnitMetadata {
            tags: tags.into_iter().map(String::from).collect(),
            source: None,
            tier: Tier::L1,
            mts_score: 0.0,
        },
    }
}

#[test]
fn test_route_sensitive_to_l3() {
    let unit = make_unit(vec!["sensitive"], 384);
    let decision = route_memory_unit(
        &unit,
        &MtsWeights::default(),
        &TierThresholds::default(),
    );
    assert_eq!(decision.tier, Tier::L3);
}

#[test]
fn test_route_standard_to_l2() {
    let unit = make_unit(vec![], 384);
    let decision = route_memory_unit(
        &unit,
        &MtsWeights::default(),
        &TierThresholds::default(),
    );
    assert_eq!(decision.tier, Tier::L2);
}

#[test]
fn test_route_with_custom_thresholds() {
    let unit = make_unit(vec![], 10);
    let thresholds = TierThresholds { l3: 0.9, l2: 0.5 };
    let decision = route_memory_unit(
        &unit,
        &MtsWeights::default(),
        &thresholds,
    );
    assert_eq!(decision.tier, Tier::L1);
}

#[test]
fn test_mts_score_calculation() {
    let unit = make_unit(vec!["sensitive"], 1000);
    let decision = route_memory_unit(
        &unit,
        &MtsWeights::default(),
        &TierThresholds::default(),
    );
    // sensitivity=1.0*0.4 + accuracy=0.5*0.3 + privilege=1.0*0.2 + compute=1.0*0.1
    // = 0.4 + 0.15 + 0.2 + 0.1 = 0.85
    assert!(decision.mts_score > 0.84);
    assert!(decision.mts_score < 0.86);
}

#[test]
fn test_l1_cache_insert_and_get() {
    let mut cache = l1_cache::L1Cache::new(60000, 100);
    let unit = make_unit(vec![], 32);
    let id = unit.uor_id;
    cache.insert(unit, 1000);
    assert!(cache.get(&id, 1000).is_some());
}

#[test]
fn test_l1_cache_ttl_expiry() {
    let mut cache = l1_cache::L1Cache::new(1000, 100);
    let unit = make_unit(vec![], 32);
    let id = unit.uor_id;
    cache.insert(unit, 0);
    assert!(cache.get(&id, 2000).is_none());
}

#[test]
fn test_l1_cache_max_size_eviction() {
    let mut cache = l1_cache::L1Cache::new(60000, 2);
    let u1 = make_unit(vec![], 32);
    let u2 = make_unit(vec![], 32);
    let u3 = make_unit(vec![], 32);
    cache.insert(u1, 1000);
    cache.insert(u2, 2000);
    cache.insert(u3, 3000);
    assert_eq!(cache.len(), 2);
}

#[test]
fn test_l2_graph_insert_and_edge() {
    let mut graph = l2_graph::L2Graph::new();
    let u1 = make_unit(vec![], 32);
    let u2 = make_unit(vec![], 32);
    let id1 = u1.uor_id;
    let id2 = u2.uor_id;
    graph.insert(u1);
    graph.insert(u2);
    graph.add_edge(id1, id2, 0.9, 1000);
    assert_eq!(graph.node_count(), 2);
    assert_eq!(graph.edge_count(), 1);
    assert_eq!(graph.neighbors(&id1).len(), 1);
}

#[test]
fn test_l2_graph_remove() {
    let mut graph = l2_graph::L2Graph::new();
    let unit = make_unit(vec![], 32);
    let id = unit.uor_id;
    graph.insert(unit);
    assert!(graph.remove(&id).is_some());
    assert_eq!(graph.node_count(), 0);
}

#[test]
fn test_l3_vault_store_and_verify() {
    let mut vault = l3_vault::L3Vault::new();
    let unit = make_unit(vec!["sensitive"], 64);
    vault.store(unit);
    assert_eq!(vault.len(), 1);
    assert!(vault.verify_integrity());
}

#[test]
fn test_l3_vault_chain_grows() {
    let mut vault = l3_vault::L3Vault::new();
    vault.store(make_unit(vec![], 32));
    vault.store(make_unit(vec![], 32));
    // genesis + 2 appends = 3 blocks
    assert_eq!(vault.ledger().len(), 3);
}
