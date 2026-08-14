use super::l3_vault::{IntegrityError, L3Vault};
use crate::chain::ledger::Ledger;
use crate::memory::types::{MemoryUnit, Tier, UnitMetadata, UorAddress};

fn make_unit(content: &str) -> MemoryUnit {
    MemoryUnit {
        address: UorAddress::from_content(content),
        embedding: vec![0.0; 32],
        created_at: 1000,
        last_accessed: 1000,
        access_count: 0,
        saturation: 0.0,
        metadata: UnitMetadata {
            tags: vec!["sensitive".to_string()],
            source: None,
            tier: Tier::L3,
            mts_score: 0.8,
        },
    }
}

#[test]
fn audited_remove_appends_delete_and_preserves_integrity() {
    let mut vault = L3Vault::new();
    let unit = make_unit("delete-me");
    let addr = unit.address.clone();
    vault.store(unit).unwrap();
    let before = vault.ledger().len();

    let removed = vault.remove(&addr).expect("stored unit should be removed");

    assert_eq!(removed.address, addr);
    assert!(vault.get(&addr).is_none());
    assert_eq!(vault.ledger().len(), before + 1);
    assert!(vault
        .ledger()
        .latest()
        .data_hash
        .starts_with(&format!("delete:{addr}:")));
    assert!(vault.verify_full().is_ok());
}

#[test]
fn missing_remove_does_not_append_delete() {
    let mut vault = L3Vault::new();
    let missing = UorAddress::from_content("missing");
    let before = vault.ledger().len();

    assert!(vault.remove(&missing).is_none());
    assert_eq!(vault.ledger().len(), before);
    assert!(vault.verify_full().is_ok());
}

#[test]
fn unrecorded_disappearance_fails_integrity() {
    let mut vault = L3Vault::new();
    let unit = make_unit("unrecorded-removal");
    let addr = unit.address.clone();
    vault.store(unit).unwrap();

    assert!(vault.remove_unrecorded_for_test(&addr).is_some());
    assert_eq!(
        vault.verify_full().unwrap_err(),
        IntegrityError::MissingLiveEntry {
            address: addr.as_str().to_string()
        }
    );
}

#[test]
fn delete_history_survives_snapshot_style_roundtrip() {
    let mut vault = L3Vault::new();
    let unit = make_unit("roundtrip-delete");
    let addr = unit.address.clone();
    vault.store(unit).unwrap();
    vault.remove(&addr).unwrap();

    let ledger_json = serde_json::to_string(vault.ledger()).unwrap();
    let ledger: Ledger = serde_json::from_str(&ledger_json).unwrap();
    let restored = L3Vault::from_parts(vault.entries_vec(), ledger);

    assert!(restored.get(&addr).is_none());
    assert!(restored
        .ledger()
        .latest()
        .data_hash
        .starts_with(&format!("delete:{addr}:")));
    assert!(restored.verify_full().is_ok());
}
