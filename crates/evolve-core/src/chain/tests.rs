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
fn test_content_hash_sha256_deterministic() {
    let h1 = content_hash(b"some bytes");
    let h2 = content_hash(b"some bytes");
    assert_eq!(h1, h2);
}

// --- BLAKE3 tests (v5.0) ---

#[test]
fn test_blake3_deterministic() {
    let h1 = blake3_hash(b"test");
    let h2 = blake3_hash(b"test");
    assert_eq!(h1, h2);
    assert_eq!(h1.len(), 64); // hex-encoded BLAKE3
}

#[test]
fn test_blake3_different_inputs() {
    let h1 = blake3_hash(b"hello");
    let h2 = blake3_hash(b"world");
    assert_ne!(h1, h2);
}

#[test]
fn test_content_address_deterministic() {
    let a1 = content_address("same content");
    let a2 = content_address("same content");
    assert_eq!(a1, a2);
}

#[test]
fn test_content_address_different_inputs() {
    let a1 = content_address("alpha");
    let a2 = content_address("beta");
    assert_ne!(a1, a2);
}

// --- try_from_blocks (v6.2 persistence robustness) ---

#[test]
fn test_try_from_blocks_rejects_empty() {
    let result = Ledger::try_from_blocks(vec![]);
    assert_eq!(result.unwrap_err(), LedgerError::EmptyBlocks);
}

#[test]
fn test_try_from_blocks_accepts_genesis() {
    let ledger = Ledger::try_from_blocks(vec![Block::genesis()]).unwrap();
    assert_eq!(ledger.len(), 1);
    assert!(ledger.verify());
}

#[test]
fn test_from_blocks_delegates_to_try_from_blocks() {
    let mut source = Ledger::new();
    source.append("abc".to_string());
    let ledger = Ledger::from_blocks(source.blocks().to_vec());
    assert_eq!(ledger.len(), 2);
    assert!(ledger.verify());
}
