use super::*;

#[test]
fn test_sha256_deterministic() {
    let h1 = sha256("test");
    let h2 = sha256("test");
    assert_eq!(h1, h2);
    assert_eq!(h1.len(), 64); // hex-encoded SHA-256
}

#[test]
fn test_sha256_different_inputs() {
    let h1 = sha256("hello");
    let h2 = sha256("world");
    assert_ne!(h1, h2);
}

#[test]
fn test_genesis_block_creation() {
    let block = Block::genesis();
    assert_eq!(block.index, 0);
    assert_eq!(block.data_hash, "GENESIS");
    assert_eq!(block.previous_hash, "0".repeat(64));
    assert_eq!(block.hash.len(), 64);
}

#[test]
fn test_block_links_to_previous() {
    let genesis = Block::genesis();
    let next = Block::new(1, "data-hash".into(), genesis.hash.clone());
    assert_eq!(next.previous_hash, genesis.hash);
    assert_eq!(next.index, 1);
}

#[test]
fn test_ledger_starts_with_genesis() {
    let ledger = Ledger::new();
    assert_eq!(ledger.len(), 1);
    assert_eq!(ledger.latest().index, 0);
}

#[test]
fn test_ledger_append() {
    let mut ledger = Ledger::new();
    ledger.append("hash-1".into());
    ledger.append("hash-2".into());
    assert_eq!(ledger.len(), 3);
    assert_eq!(ledger.latest().index, 2);
}

#[test]
fn test_ledger_chain_integrity() {
    let mut ledger = Ledger::new();
    ledger.append("data-1".into());
    ledger.append("data-2".into());
    ledger.append("data-3".into());
    assert!(ledger.verify());
}

#[test]
fn test_content_hash_deterministic() {
    let h1 = content_hash(b"some bytes");
    let h2 = content_hash(b"some bytes");
    assert_eq!(h1, h2);
}
