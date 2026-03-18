use serde::{Deserialize, Serialize};

/// Immutable block in the hash chain.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Block {
    pub index: u64,
    pub timestamp: i64,
    pub data_hash: String,
    pub previous_hash: String,
    pub hash: String,
}

impl Block {
    /// Create the genesis block (index 0, no predecessor).
    pub fn genesis() -> Self {
        let timestamp = chrono::Utc::now().timestamp_millis();
        let data_hash = "GENESIS".to_string();
        let previous_hash = "0".repeat(64);
        let hash = crate::chain::hash::compute_block_hash(
            0, timestamp, &data_hash, &previous_hash,
        );

        Self {
            index: 0,
            timestamp,
            data_hash,
            previous_hash,
            hash,
        }
    }

    /// Create a new block linking to the given previous hash.
    pub fn new(index: u64, data_hash: String, previous_hash: String) -> Self {
        let timestamp = chrono::Utc::now().timestamp_millis();
        let hash = crate::chain::hash::compute_block_hash(
            index, timestamp, &data_hash, &previous_hash,
        );

        Self {
            index,
            timestamp,
            data_hash,
            previous_hash,
            hash,
        }
    }
}
