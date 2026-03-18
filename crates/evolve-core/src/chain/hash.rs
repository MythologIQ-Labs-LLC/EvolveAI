use sha2::{Digest, Sha256};

/// Compute SHA-256 hash of a string, returned as lowercase hex.
pub fn sha256(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

/// Compute a block hash from its constituent components.
pub fn compute_block_hash(
    index: u64,
    timestamp: i64,
    data_hash: &str,
    previous_hash: &str,
) -> String {
    let input = format!("{index}{timestamp}{data_hash}{previous_hash}");
    sha256(&input)
}

/// Compute a content hash from raw bytes.
pub fn content_hash(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}
