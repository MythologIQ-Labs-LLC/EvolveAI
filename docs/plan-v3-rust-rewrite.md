# Plan: v3.0 Rust Rewrite

## Overview

Full rewrite of EvolveAI in Rust. TypeScript codebase serves as reference documentation only.

**Stack Integration**:
- **GG-CORE** (`G:\mythologiq\GG\GG-CORE`): Apache 2.0 inference runtime
  - GGUF backend (llama-cpp-2) for LLM inference
  - ONNX backend (Candle) for embeddings
  - Sandboxed, air-gap capable, zero network dependencies
- **GG-CORE-Tiersynergy** (`G:\mythologiq\GG\GG-CORE-Tiersynergy`): Proprietary extension
  - Bronze/Silver/Gold service tiers
  - Per-session rate limiting (token bucket)
  - Memory isolation (bumpalo arena allocators)
  - Priority queuing during resource contention

**EvolveAI Role**: Autopoietic memory layer on top of GG-CORE
- Uses GG-CORE ONNX backend for semantic embeddings
- Integrates with Tiersynergy for multi-tenant memory management
- Provides tiered memory storage (L1/L2/L3) aligned with service tiers

---

## Open Questions

1. **Embedding model**: Which ONNX model for semantic embeddings? (all-MiniLM-L6-v2 equivalent)
2. **Persistence**: SQLite via `rusqlite` or memory-mapped files via `memmap2`?
3. **Location**: Workspace member in GG-CORE or separate repo with path dependency?

---

## Crate Structure

**Option A**: Workspace member in GG-CORE monorepo
```
G:\mythologiq\GG\GG-CORE\
├── core-runtime/           # Existing gg-core crate
├── evolve-memory/          # NEW: Autopoietic memory crate
│   ├── src/
│   │   ├── lib.rs
│   │   ├── representation/ # Embedding abstraction (wraps gg-core ONNX)
│   │   ├── memory/         # Encoder, decoder, decay
│   │   ├── tiers/          # L1, L2, L3 + router
│   │   ├── chain/          # Cryptographic ledger
│   │   ├── graph/          # Associative network
│   │   └── shadow/         # Failure patterns
│   └── Cargo.toml
└── ...
```

**Option B**: Separate repo with path dependency (current D:\EvolveAI → Rust)
```
D:\EvolveAI\                # Or G:\mythologiq\evolve-memory
├── Cargo.toml              # Workspace root
├── src/
│   ├── lib.rs
│   ├── representation/
│   ├── memory/
│   ├── tiers/
│   ├── chain/
│   ├── graph/
│   └── shadow/
└── Cargo.toml

# Depends on GG-CORE via path:
# gg-core = { path = "G:/mythologiq/GG/GG-CORE/core-runtime", features = ["onnx"] }
```

---

## Phase 1: Core Types & Representation

### Affected Files

- `crates/evolve-core/src/lib.rs` - Crate root
- `crates/evolve-core/src/representation/mod.rs` - Module root
- `crates/evolve-core/src/representation/types.rs` - Core types
- `crates/evolve-core/src/representation/engine.rs` - Engine trait
- `crates/evolve-core/src/representation/similarity.rs` - Vector math
- `crates/evolve-core/src/representation/mock.rs` - Mock engine for tests

### Changes

**crates/evolve-core/src/representation/types.rs**

```rust
use serde::{Deserialize, Serialize};

/// Opaque representation of encoded content.
/// Model-agnostic container for embeddings.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Representation {
    /// Raw bytes (header + vector data)
    pub bytes: Vec<u8>,
    /// Source model identifier
    pub model_id: String,
    /// Serialization version
    pub version: u8,
}

/// Similarity computation strategy
#[derive(Clone, Copy, Debug, Default)]
pub enum SimilarityStrategy {
    #[default]
    Cosine,
    Euclidean,
    DotProduct,
}

/// Cross-model comparison result
#[derive(Clone, Debug)]
pub struct CrossModelResult {
    pub score: f32,
    pub degraded: bool,
    pub reason: Option<String>,
}

/// Engine capabilities
#[derive(Clone, Debug)]
pub struct EngineCapabilities {
    pub supported_strategies: Vec<SimilarityStrategy>,
    pub supports_batch: bool,
    pub supports_quantization: bool,
    pub supports_cross_model: bool,
}
```

**crates/evolve-core/src/representation/engine.rs**

```rust
use crate::representation::{
    CrossModelResult, EngineCapabilities, Representation, SimilarityStrategy,
};
use std::future::Future;

/// Representation engine trait.
/// Abstracts embedding generation and comparison.
pub trait RepresentationEngine: Send + Sync {
    /// Model identifier
    fn model_id(&self) -> &str;

    /// Engine capabilities
    fn capabilities(&self) -> &EngineCapabilities;

    /// Encode content to representation
    fn encode(&self, content: &str) -> impl Future<Output = Result<Representation, EngineError>> + Send;

    /// Batch encode
    fn encode_batch(&self, contents: &[&str]) -> impl Future<Output = Result<Vec<Representation>, EngineError>> + Send;

    /// Compute similarity
    fn similarity(&self, a: &Representation, b: &Representation, strategy: SimilarityStrategy) -> f32;

    /// Cross-model comparison
    fn cross_model_similarity(&self, a: &Representation, b: &Representation) -> CrossModelResult;

    /// Serialize representation
    fn serialize(&self, rep: &Representation) -> Vec<u8>;

    /// Deserialize representation
    fn deserialize(&self, bytes: &[u8]) -> Result<Representation, EngineError>;

    /// Check if representation is native to this engine
    fn is_native(&self, rep: &Representation) -> bool;
}

#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("Encoding failed: {0}")]
    EncodingFailed(String),
    #[error("Deserialization failed: {0}")]
    DeserializationFailed(String),
    #[error("Model not initialized")]
    NotInitialized,
}
```

**crates/evolve-core/src/representation/similarity.rs**

```rust
/// Cosine similarity between two vectors
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    debug_assert_eq!(a.len(), b.len());

    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot / (norm_a * norm_b)
}

/// Euclidean distance between two vectors
pub fn euclidean_distance(a: &[f32], b: &[f32]) -> f32 {
    debug_assert_eq!(a.len(), b.len());

    a.iter()
        .zip(b.iter())
        .map(|(x, y)| (x - y).powi(2))
        .sum::<f32>()
        .sqrt()
}

/// Convert euclidean distance to similarity score
pub fn euclidean_to_similarity(distance: f32) -> f32 {
    1.0 / (1.0 + distance)
}

/// Dot product between two vectors
pub fn dot_product(a: &[f32], b: &[f32]) -> f32 {
    debug_assert_eq!(a.len(), b.len());
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}
```

### Unit Tests

- `crates/evolve-core/src/representation/tests.rs`
  - `test_cosine_similarity_identical_vectors` - Returns 1.0 for same vectors
  - `test_cosine_similarity_orthogonal` - Returns 0.0 for orthogonal vectors
  - `test_euclidean_distance_same_point` - Returns 0.0 for identical vectors
  - `test_dot_product_calculation` - Verifies dot product math
  - `test_representation_serialization_roundtrip` - Serialize/deserialize preserves data
  - `test_mock_engine_encode` - Mock engine returns valid representation

---

## Phase 2: Memory Types & Hash Chain

### Affected Files

- `crates/evolve-core/src/memory/mod.rs` - Module root
- `crates/evolve-core/src/memory/types.rs` - MemoryUnit, RawInput, Query
- `crates/evolve-core/src/memory/decay.rs` - CMHL decay calculation
- `crates/evolve-core/src/chain/mod.rs` - Module root
- `crates/evolve-core/src/chain/block.rs` - Block structure
- `crates/evolve-core/src/chain/hash.rs` - SHA-256 hashing
- `crates/evolve-core/src/chain/ledger.rs` - Chain management

### Changes

**crates/evolve-core/src/memory/types.rs**

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Universal Object Reference - unique memory identifier
pub type UorId = Uuid;

/// Raw input before encoding
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RawInput {
    pub content: String,
    pub content_type: ContentType,
    pub metadata: InputMetadata,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub enum ContentType {
    #[default]
    Text,
    Structured,
    Binary,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct InputMetadata {
    pub tags: Vec<String>,
    pub source: Option<String>,
    pub priority: Priority,
    pub sensitivity: Sensitivity,
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
pub enum Priority {
    Low,
    #[default]
    Normal,
    High,
    Critical,
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
pub enum Sensitivity {
    #[default]
    Public,
    Internal,
    Confidential,
    Restricted,
}

/// Encoded memory unit
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MemoryUnit {
    pub uor_id: UorId,
    pub embedding: Vec<f32>,
    pub content_hash: String,
    pub created_at: i64,
    pub last_accessed: i64,
    pub access_count: u32,
    pub decay_factor: f32,
    pub metadata: UnitMetadata,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct UnitMetadata {
    pub tags: Vec<String>,
    pub source: Option<String>,
    pub tier: Tier,
    pub mts_score: f32,
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub enum Tier {
    #[default]
    L1,
    L2,
    L3,
}
```

**crates/evolve-core/src/memory/decay.rs**

```rust
/// CMHL (Continuous Memory Half-Life) decay calculation
///
/// Implements lazy exponential decay based on time since last access.
pub fn calculate_decay(
    last_accessed: i64,
    current_time: i64,
    half_life_ms: i64,
    base_factor: f32,
) -> f32 {
    let elapsed = current_time - last_accessed;
    if elapsed <= 0 {
        return base_factor;
    }

    let half_lives = elapsed as f32 / half_life_ms as f32;
    base_factor * 0.5_f32.powf(half_lives)
}

/// Check if memory should be pruned
pub fn should_prune(decay_factor: f32, threshold: f32) -> bool {
    decay_factor < threshold
}

/// Calculate effective strength (access-boosted decay)
pub fn effective_strength(decay_factor: f32, access_count: u32, boost_factor: f32) -> f32 {
    let boost = 1.0 + (access_count as f32 * boost_factor).min(2.0);
    (decay_factor * boost).min(1.0)
}
```

**crates/evolve-core/src/chain/block.rs**

```rust
use serde::{Deserialize, Serialize};

/// Immutable block in the hash chain
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Block {
    pub index: u64,
    pub timestamp: i64,
    pub data_hash: String,
    pub previous_hash: String,
    pub hash: String,
}

impl Block {
    pub fn genesis() -> Self {
        let timestamp = chrono::Utc::now().timestamp_millis();
        let data_hash = "GENESIS".to_string();
        let previous_hash = "0".repeat(64);
        let hash = crate::chain::hash::compute_block_hash(0, timestamp, &data_hash, &previous_hash);

        Self {
            index: 0,
            timestamp,
            data_hash,
            previous_hash,
            hash,
        }
    }

    pub fn new(index: u64, data_hash: String, previous_hash: String) -> Self {
        let timestamp = chrono::Utc::now().timestamp_millis();
        let hash = crate::chain::hash::compute_block_hash(index, timestamp, &data_hash, &previous_hash);

        Self {
            index,
            timestamp,
            data_hash,
            previous_hash,
            hash,
        }
    }
}
```

### Unit Tests

- `crates/evolve-core/src/memory/tests.rs`
  - `test_decay_no_time_elapsed` - Returns base factor when no time passed
  - `test_decay_one_half_life` - Returns half of base after one half-life
  - `test_decay_multiple_half_lives` - Exponential decay over time
  - `test_should_prune_below_threshold` - Correctly identifies prunable memories
  - `test_effective_strength_boost` - Access count boosts strength

- `crates/evolve-core/src/chain/tests.rs`
  - `test_genesis_block_creation` - Genesis has index 0, valid hash
  - `test_block_chain_integrity` - Each block links to previous
  - `test_block_hash_deterministic` - Same inputs produce same hash

---

## Phase 3: Tier System & Router

### Affected Files

- `crates/evolve-core/src/tiers/mod.rs` - Module root
- `crates/evolve-core/src/tiers/router.rs` - MTS routing logic
- `crates/evolve-core/src/tiers/l1_cache.rs` - Ephemeral cache
- `crates/evolve-core/src/tiers/l2_graph.rs` - Associative graph
- `crates/evolve-core/src/tiers/l3_vault.rs` - Cryptographic vault

### Changes

**crates/evolve-core/src/tiers/router.rs**

```rust
use crate::memory::types::{MemoryUnit, Tier};

/// MTS (Memory Tier Score) weights
#[derive(Clone, Debug)]
pub struct MtsWeights {
    pub sensitivity: f32,
    pub accuracy: f32,
    pub privilege: f32,
    pub compute: f32,
}

impl Default for MtsWeights {
    fn default() -> Self {
        Self {
            sensitivity: 0.4,
            accuracy: 0.3,
            privilege: 0.2,
            compute: 0.1,
        }
    }
}

/// Tier thresholds
#[derive(Clone, Debug)]
pub struct TierThresholds {
    pub l3: f32,  // Score >= this -> L3
    pub l2: f32,  // Score >= this -> L2, else L1
}

impl Default for TierThresholds {
    fn default() -> Self {
        Self { l3: 0.8, l2: 0.3 }
    }
}

/// Routing decision
#[derive(Clone, Debug)]
pub struct RouteDecision {
    pub tier: Tier,
    pub mts_score: f32,
    pub factors: MtsFactors,
}

#[derive(Clone, Debug, Default)]
pub struct MtsFactors {
    pub sensitivity: f32,
    pub accuracy: f32,
    pub privilege: f32,
    pub compute: f32,
}

/// Route memory unit to appropriate tier
pub fn route_memory_unit(
    unit: &MemoryUnit,
    weights: &MtsWeights,
    thresholds: &TierThresholds,
) -> RouteDecision {
    let factors = calculate_factors(unit);
    let mts_score = calculate_mts(&factors, weights);
    let tier = determine_tier(mts_score, thresholds);

    RouteDecision {
        tier,
        mts_score,
        factors,
    }
}

fn calculate_factors(unit: &MemoryUnit) -> MtsFactors {
    // Factor calculation based on unit metadata
    MtsFactors {
        sensitivity: match unit.metadata.tags.iter().any(|t| t == "sensitive") {
            true => 1.0,
            false => 0.2,
        },
        accuracy: 0.5,  // Default mid-range
        privilege: 0.3,
        compute: unit.embedding.len() as f32 / 1000.0,
    }
}

fn calculate_mts(factors: &MtsFactors, weights: &MtsWeights) -> f32 {
    factors.sensitivity * weights.sensitivity
        + factors.accuracy * weights.accuracy
        + factors.privilege * weights.privilege
        + factors.compute * weights.compute
}

fn determine_tier(score: f32, thresholds: &TierThresholds) -> Tier {
    if score >= thresholds.l3 {
        Tier::L3
    } else if score >= thresholds.l2 {
        Tier::L2
    } else {
        Tier::L1
    }
}
```

### Unit Tests

- `crates/evolve-core/src/tiers/tests.rs`
  - `test_route_sensitive_to_l3` - Sensitive tagged memory routes to L3
  - `test_route_standard_to_l2` - Standard memory routes to L2
  - `test_route_ephemeral_to_l1` - Low-priority routes to L1
  - `test_mts_score_calculation` - Weighted sum is correct
  - `test_custom_thresholds` - Custom thresholds respected

---

## Phase 4: GG-Core Integration

### Affected Files

- `src/representation/ggcore.rs` - GG-Core engine adapter
- `Cargo.toml` - Add gg-core dependency with `onnx` feature

### Changes

**Cargo.toml**

```toml
[package]
name = "evolve-memory"
version = "0.1.0"
edition = "2021"
license = "Apache-2.0"

[dependencies]
# GG-CORE for inference (ONNX embeddings)
gg-core = { path = "G:/mythologiq/GG/GG-CORE/core-runtime", features = ["onnx"] }

# GG-CORE-Tiersynergy for multi-tenant memory management (optional)
gg-core-tiersynergy = { path = "G:/mythologiq/GG/GG-CORE-Tiersynergy", optional = true }

# Async runtime (same as GG-CORE)
tokio = { version = "1.35", features = ["rt-multi-thread", "sync", "time", "macros"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# IDs
uuid = { version = "1.6", features = ["v4", "serde"] }

# Time
chrono = { version = "0.4", features = ["serde"] }

# Hashing (same as GG-CORE)
sha2 = "0.10"
hex = "0.4"

# Error handling
thiserror = "1.0"

# Tracing (same as GG-CORE)
tracing = "0.1"

[features]
default = []
tiersynergy = ["gg-core-tiersynergy"]
```

**src/representation/ggcore.rs**

```rust
use crate::representation::{
    CrossModelResult, EngineCapabilities, EngineError, Representation,
    RepresentationEngine, SimilarityStrategy,
};
use gg_core::onnx::{OnnxBackend, OnnxConfig};
use std::sync::Arc;

/// GG-Core backed representation engine using ONNX embeddings
pub struct GgCoreEngine {
    model_id: String,
    backend: Arc<OnnxBackend>,
    capabilities: EngineCapabilities,
}

impl GgCoreEngine {
    /// Create engine with ONNX embedding model
    pub async fn new(model_path: &str, model_id: &str) -> Result<Self, EngineError> {
        let config = OnnxConfig {
            model_path: model_path.into(),
            ..Default::default()
        };

        let backend = OnnxBackend::new(config)
            .await
            .map_err(|e| EngineError::EncodingFailed(e.to_string()))?;

        Ok(Self {
            model_id: model_id.to_string(),
            backend: Arc::new(backend),
            capabilities: EngineCapabilities {
                supported_strategies: vec![
                    SimilarityStrategy::Cosine,
                    SimilarityStrategy::Euclidean,
                    SimilarityStrategy::DotProduct,
                ],
                supports_batch: true,
                supports_quantization: false, // ONNX handles internally
                supports_cross_model: false,
            },
        })
    }
}

impl RepresentationEngine for GgCoreEngine {
    fn model_id(&self) -> &str {
        &self.model_id
    }

    fn capabilities(&self) -> &EngineCapabilities {
        &self.capabilities
    }

    async fn encode(&self, content: &str) -> Result<Representation, EngineError> {
        // Use GG-CORE ONNX backend for embedding
        let embedding = self.backend
            .embed(content)
            .await
            .map_err(|e| EngineError::EncodingFailed(e.to_string()))?;

        Ok(Representation::from_vector(&self.model_id, embedding))
    }

    async fn encode_batch(&self, contents: &[&str]) -> Result<Vec<Representation>, EngineError> {
        let embeddings = self.backend
            .embed_batch(contents)
            .await
            .map_err(|e| EngineError::EncodingFailed(e.to_string()))?;

        Ok(embeddings
            .into_iter()
            .map(|emb| Representation::from_vector(&self.model_id, emb))
            .collect())
    }

    fn similarity(&self, a: &Representation, b: &Representation, strategy: SimilarityStrategy) -> f32 {
        let vec_a = a.as_vector();
        let vec_b = b.as_vector();

        match strategy {
            SimilarityStrategy::Cosine => crate::representation::similarity::cosine_similarity(&vec_a, &vec_b),
            SimilarityStrategy::Euclidean => {
                let dist = crate::representation::similarity::euclidean_distance(&vec_a, &vec_b);
                crate::representation::similarity::euclidean_to_similarity(dist)
            }
            SimilarityStrategy::DotProduct => crate::representation::similarity::dot_product(&vec_a, &vec_b),
        }
    }

    fn cross_model_similarity(&self, a: &Representation, b: &Representation) -> CrossModelResult {
        if a.model_id != b.model_id {
            return CrossModelResult {
                score: 0.0,
                degraded: true,
                reason: Some("Cross-model comparison not supported".into()),
            };
        }

        CrossModelResult {
            score: self.similarity(a, b, SimilarityStrategy::Cosine),
            degraded: false,
            reason: None,
        }
    }

    fn serialize(&self, rep: &Representation) -> Vec<u8> {
        rep.bytes.clone()
    }

    fn deserialize(&self, bytes: &[u8]) -> Result<Representation, EngineError> {
        Representation::from_bytes(bytes)
            .map_err(|e| EngineError::DeserializationFailed(e.to_string()))
    }

    fn is_native(&self, rep: &Representation) -> bool {
        rep.model_id == self.model_id
    }
}
```

### Unit Tests

- `src/representation/ggcore_tests.rs`
  - `test_ggcore_engine_initialization` - Engine initializes with ONNX model
  - `test_ggcore_encode_returns_representation` - Encoding produces valid output
  - `test_ggcore_encode_batch` - Batch encoding works correctly
  - `test_ggcore_similarity_calculation` - Similarity works on encoded representations
  - `test_ggcore_serialization_roundtrip` - Serialize/deserialize preserves data

---

## Dependencies

**Cargo.toml (workspace)**

```toml
[workspace]
members = ["crates/*"]
resolver = "2"

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
sha2 = "0.10"
thiserror = "1"
tracing = "0.1"

# gg-core = { path = "../gg-core" }  # Or git dependency
```

**crates/evolve-core/Cargo.toml**

```toml
[package]
name = "evolve-core"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio.workspace = true
serde.workspace = true
serde_json.workspace = true
uuid.workspace = true
chrono.workspace = true
sha2.workspace = true
thiserror.workspace = true
tracing.workspace = true
```

---

## Summary

| Phase | Focus | Deliverable |
|-------|-------|-------------|
| 1 | Representation | Engine trait, similarity math, mock engine |
| 2 | Memory & Chain | MemoryUnit types, CMHL decay, hash chain |
| 3 | Tier System | MTS router, L1/L2/L3 tier implementations |
| 4 | GG-Core | Integration with gg-core ONNX backend |

### Design Principles Applied

1. **Simple over Easy**: Trait-based abstraction, no inheritance
2. **Values over State**: Immutable `Representation`, `Block`, `MemoryUnit`
3. **Declarative**: Configuration structs, not builder patterns
4. **Composable**: Each module independent, combined at processor level

---

_Plan follows Simple Made Easy principles_
