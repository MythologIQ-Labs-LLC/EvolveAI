use crate::chain::block::Block;
use crate::chain::hash;
use serde::{Deserialize, Serialize};

/// In-memory hash chain ledger providing append-only integrity.
#[derive(Debug, Serialize, Deserialize)]
pub struct Ledger {
    blocks: Vec<Block>,
}

impl Ledger {
    /// Create a new ledger initialized with the genesis block.
    pub fn new() -> Self {
        Self {
            blocks: vec![Block::genesis()],
        }
    }

    /// Append a new block containing `data_hash` to the chain.
    pub fn append(&mut self, data_hash: String) -> &Block {
        let previous = self.blocks.last().expect("ledger always has genesis");
        let index = previous.index + 1;
        let block = Block::new(index, data_hash, previous.hash.clone());
        self.blocks.push(block);
        self.blocks.last().expect("just pushed")
    }

    /// Get the latest (most recent) block.
    pub fn latest(&self) -> &Block {
        self.blocks.last().expect("ledger always has genesis")
    }

    /// Get all blocks as a slice.
    pub fn blocks(&self) -> &[Block] {
        &self.blocks
    }

    /// Number of blocks in the chain.
    pub fn len(&self) -> usize {
        self.blocks.len()
    }

    /// Returns true if the chain contains only the genesis block.
    pub fn is_empty(&self) -> bool {
        self.blocks.len() <= 1
    }

    /// Verify the integrity of the entire chain.
    ///
    /// Checks that each block's `previous_hash` matches the preceding
    /// block's `hash`, and that each block's hash is correctly computed.
    pub fn verify(&self) -> bool {
        for i in 1..self.blocks.len() {
            let current = &self.blocks[i];
            let previous = &self.blocks[i - 1];

            if current.previous_hash != previous.hash {
                return false;
            }

            let expected = hash::compute_block_hash(
                current.index,
                current.timestamp,
                &current.data_hash,
                &current.previous_hash,
            );
            if current.hash != expected {
                return false;
            }
        }
        true
    }

    /// Reconstruct ledger from existing blocks.
    /// Caller must ensure blocks form a valid chain.
    pub fn from_blocks(blocks: Vec<Block>) -> Self {
        assert!(!blocks.is_empty(), "ledger requires at least genesis block");
        Self { blocks }
    }
}

impl Default for Ledger {
    fn default() -> Self {
        Self::new()
    }
}
