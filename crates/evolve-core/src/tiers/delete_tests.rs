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
            mts_score: 1.0,
        },
    }
}

fn cloned_ledger(vault: &L3Vault) -> Ledger {
    Ledger::from_blocks(vault.ledger().blocks().to_vec())
}

#[test]
fn audited_delete_records_prior_hash_and_preserves_integrity() {
    let mut vault = L3Vault::new();
    let unit = make_unit("audited-delete");
    let addr = unit.address.clone();
    vault.store(unit).unwrap();

    let store_payload = vault.ledger().latest().data_hash.clone();
    let prior_hash = store_payload
        .rsplit(':')
        .next()
        .expect("store payload contains content hash")
        .to_string();
    let len_before = vault.ledger().len();

    let removed = vault.remove(&addr).expect("stored unit should be removed");

    assert_eq!(removed.address, addr);
    assert!(vault.get(&addr).is_none());
    assert_eq!(vault.ledger().len(), len_before + 1);
    assert_eq!(
        vault.ledger().latest().data_hash,
        format!("delete:{addr}:{prior_hash}")
    );
    assert!(vault.verify_full().is_ok());
}

#[test]
fn missing_delete_does_not_append_ledger_entry() {
    let mut vault = L3Vault::new();
    let addr = UorAddress::from_content("absent-delete");
    let len_before = vault.ledger().len();

    assert!(vault.remove(&addr).is_none());
    assert_eq!(vault.ledger().len(), len_before);
    assert!(vault.verify_full().is_ok());
}

#[test]
fn raw_unrecorded_removal_is_detected() {
    let mut source = L3Vault::new();
    let unit = make_unit("raw-removal");
    let addr = unit.address.clone();
    source.store(unit).unwrap();

    let vault = L3Vault::from_parts(Vec::new(), cloned_ledger(&source));

    assert_eq!(
        vault.verify_full(),
        Err(IntegrityError::MissingLiveEntry {
            address: addr.as_str().to_string(),
        })
    );
}

#[test]
fn deleted_ledger_state_rejects_reappearing_live_entry() {
    let mut source = L3Vault::new();
    let unit = make_unit("deleted-but-present");
    let addr = unit.address.clone();
    source.store(unit.clone()).unwrap();
    source.remove(&addr).unwrap();

    let vault = L3Vault::from_parts(vec![unit], cloned_ledger(&source));

    assert_eq!(
        vault.verify_full(),
        Err(IntegrityError::DeletedEntryPresent {
            address: addr.as_str().to_string(),
        })
    );
}

#[test]
fn tampered_live_entry_cannot_be_laundered_by_delete() {
    let mut vault = L3Vault::new();
    let unit = make_unit("tamper-before-delete");
    let addr = unit.address.clone();
    vault.store(unit).unwrap();
    let len_before = vault.ledger().len();

    vault.get_mut(&addr).unwrap().saturation = 0.75;

    assert!(vault.remove(&addr).is_none());
    assert_eq!(vault.ledger().len(), len_before);
    assert!(vault.get(&addr).is_some());
    assert_eq!(
        vault.verify_full(),
        Err(IntegrityError::UnitHashMismatch {
            address: addr.as_str().to_string(),
        })
    );
}

#[test]
fn restored_parts_preserve_delete_history() {
    let mut source = L3Vault::new();
    let unit = make_unit("restore-deleted-history");
    let addr = unit.address.clone();
    source.store(unit).unwrap();
    source
        .update_with(&addr, |u| {
            u.access_count += 1;
            u.saturation = 0.5;
        })
        .expect("unit exists")
        .expect("update remains valid");
    source.remove(&addr).unwrap();

    let restored = L3Vault::from_parts(source.entries_vec(), cloned_ledger(&source));

    assert!(restored.get(&addr).is_none());
    assert!(restored.verify_full().is_ok());
    assert!(restored.ledger().latest().data_hash.starts_with("delete:"));
    assert_eq!(restored.ledger().len(), 4); // genesis + store + update + delete
}
