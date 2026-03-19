use super::*;
use crate::memory::types::{MemoryUnit, Tier, UnitMetadata, UorAddress};

fn make_unit(content: &str, tags: Vec<&str>, embedding_len: usize) -> MemoryUnit {
    MemoryUnit {
        address: UorAddress::from_content(content),
        embedding: vec![0.0; embedding_len],
        created_at: 1000,
        last_accessed: 1000,
        access_count: 0,
        saturation: 0.0,
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
    let unit = make_unit("sensitive-data", vec!["sensitive"], 384);
    let decision = route_memory_unit(
        &unit,
        &MtsWeights::default(),
        &TierThresholds::default(),
    );
    assert_eq!(decision.tier, Tier::L3);
}

#[test]
fn test_route_standard_to_l2() {
    let unit = make_unit("normal-data", vec![], 384);
    let decision = route_memory_unit(
        &unit,
        &MtsWeights::default(),
        &TierThresholds::default(),
    );
    assert_eq!(decision.tier, Tier::L2);
}

#[test]
fn test_route_with_custom_thresholds() {
    let unit = make_unit("small-data", vec![], 10);
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
    let unit = make_unit("scored-data", vec!["sensitive"], 1000);
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
fn test_crystallized_memory_routes_to_l3() {
    let mut unit = make_unit("crystallized", vec![], 32);
    unit.saturation = 0.96;
    let decision = route_memory_unit(
        &unit,
        &MtsWeights::default(),
        &TierThresholds::default(),
    );
    assert_eq!(decision.tier, Tier::L3);
}

#[test]
fn test_l1_cache_insert_and_get() {
    let mut cache = l1_cache::L1Cache::new(60000, 100);
    let unit = make_unit("cached", vec![], 32);
    let addr = unit.address.clone();
    cache.insert(unit, 1000);
    assert!(cache.get(&addr, 1000).is_some());
}

#[test]
fn test_l1_cache_ttl_expiry() {
    let mut cache = l1_cache::L1Cache::new(1000, 100);
    let unit = make_unit("expiring", vec![], 32);
    let addr = unit.address.clone();
    cache.insert(unit, 0);
    assert!(cache.get(&addr, 2000).is_none());
}

#[test]
fn test_l1_cache_max_size_eviction() {
    let mut cache = l1_cache::L1Cache::new(60000, 2);
    cache.insert(make_unit("a", vec![], 32), 1000);
    cache.insert(make_unit("b", vec![], 32), 2000);
    cache.insert(make_unit("c", vec![], 32), 3000);
    assert_eq!(cache.len(), 2);
}

#[test]
fn test_l2_graph_insert_and_edge() {
    let mut graph = l2_graph::L2Graph::new();
    let u1 = make_unit("node1", vec![], 32);
    let u2 = make_unit("node2", vec![], 32);
    let a1 = u1.address.clone();
    let a2 = u2.address.clone();
    graph.insert(u1);
    graph.insert(u2);
    graph.add_edge(a1.clone(), a2, 0.9, 1000);
    assert_eq!(graph.node_count(), 2);
    assert_eq!(graph.edge_count(), 1);
    assert_eq!(graph.neighbors(&a1).len(), 1);
}

#[test]
fn test_l2_graph_remove() {
    let mut graph = l2_graph::L2Graph::new();
    let unit = make_unit("removable", vec![], 32);
    let addr = unit.address.clone();
    graph.insert(unit);
    assert!(graph.remove(&addr).is_some());
    assert_eq!(graph.node_count(), 0);
}

#[test]
fn test_l3_vault_store_and_verify() {
    let mut vault = l3_vault::L3Vault::new();
    let unit = make_unit("vault-data", vec!["sensitive"], 64);
    vault.store(unit);
    assert_eq!(vault.len(), 1);
    assert!(vault.verify_integrity());
}

#[test]
fn test_l3_vault_chain_grows() {
    let mut vault = l3_vault::L3Vault::new();
    vault.store(make_unit("v1", vec![], 32));
    vault.store(make_unit("v2", vec![], 32));
    // genesis + 2 appends = 3 blocks
    assert_eq!(vault.ledger().len(), 3);
}

#[test]
fn test_l3_vault_get_by_address() {
    let mut vault = l3_vault::L3Vault::new();
    let unit = make_unit("addressable", vec![], 32);
    let addr = unit.address.clone();
    vault.store(unit);
    assert!(vault.get_by_address(&addr).is_some());
}

#[test]
fn test_l3_vault_address_miss() {
    let vault = l3_vault::L3Vault::new();
    let addr = UorAddress::from_content("nonexistent");
    assert!(vault.get_by_address(&addr).is_none());
}

#[test]
fn test_l1_cache_iter_units_excludes_expired() {
    let mut cache = l1_cache::L1Cache::new(1000, 100);
    cache.insert(make_unit("early", vec![], 32), 0);
    cache.insert(make_unit("later", vec![], 32), 500);
    // At now=1200, first (inserted at 0) is expired, second (inserted at 500) is still valid
    let count = cache.iter_units(1200).count();
    assert_eq!(count, 1);
}

#[test]
fn test_l2_graph_iter_units() {
    let mut graph = l2_graph::L2Graph::new();
    graph.insert(make_unit("g1", vec![], 32));
    graph.insert(make_unit("g2", vec![], 32));
    graph.insert(make_unit("g3", vec![], 32));
    assert_eq!(graph.iter_units().count(), 3);
}

#[test]
fn test_l3_vault_iter_units() {
    let mut vault = l3_vault::L3Vault::new();
    vault.store(make_unit("vi1", vec![], 32));
    vault.store(make_unit("vi2", vec![], 32));
    assert_eq!(vault.iter_units().count(), 2);
}

// --- Co-capture linking tests (v5.2) ---

#[test]
fn test_link_to_session_creates_bidirectional_edges() {
    let mut graph = l2_graph::L2Graph::new();
    let u1 = make_unit("s1", vec![], 32);
    let u2 = make_unit("s2", vec![], 32);
    let u3 = make_unit("s3", vec![], 32);
    let a1 = u1.address.clone();
    let a2 = u2.address.clone();
    let a3 = u3.address.clone();

    graph.insert(u1);
    let session = vec![];
    graph.link_to_session(&a1, &session, 1000);

    graph.insert(u2);
    let session = vec![(a1.clone(), 1000)];
    graph.link_to_session(&a2, &session, 1001);

    graph.insert(u3);
    let session = vec![(a1.clone(), 1000), (a2.clone(), 1001)];
    graph.link_to_session(&a3, &session, 1002);

    // A1↔A2, A1↔A3, A2↔A3 = 6 directed edges
    assert_eq!(graph.edge_count(), 6);
    assert_eq!(graph.neighbors(&a1).len(), 2);
    assert_eq!(graph.neighbors(&a3).len(), 2);
}

#[test]
fn test_link_to_session_weight_decreases_with_gap() {
    let mut graph = l2_graph::L2Graph::new();
    let u1 = make_unit("close", vec![], 32);
    let u2 = make_unit("far", vec![], 32);
    let u3 = make_unit("new", vec![], 32);
    let a1 = u1.address.clone();
    let a2 = u2.address.clone();
    let a3 = u3.address.clone();

    graph.insert(u1);
    graph.insert(u2);
    graph.insert(u3);

    // a1 at t=9990 (10ms gap), a2 at t=0 (10s gap)
    let session = vec![(a1.clone(), 9990), (a2.clone(), 0)];
    graph.link_to_session(&a3, &session, 10000);

    let close_edge = &graph.edges_from(&a3)[0]; // a1 is first in session
    let far_edge = &graph.edges_from(&a3)[1];   // a2 is second
    assert!(close_edge.weight > far_edge.weight);
}

#[test]
fn test_link_to_session_skips_missing_peers() {
    let mut graph = l2_graph::L2Graph::new();
    let u1 = make_unit("exists", vec![], 32);
    let a1 = u1.address.clone();
    graph.insert(u1);

    let missing = UorAddress::from_content("removed");
    let session = vec![(missing, 1000)];
    graph.link_to_session(&a1, &session, 2000);
    assert_eq!(graph.edge_count(), 0);
}
