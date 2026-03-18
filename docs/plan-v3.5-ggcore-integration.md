# Plan: v3.5 GG-CORE Integration

## Open Questions

1. **GG-CORE embedder status**: The `OnnxEmbedder::embed_text()` is currently stubbed in GG-CORE (returns error when model not loaded). Should we gate on it being functional? **Decision**: No — we write the adapter against the stable API types. It will work once GG-CORE's Candle integration lands. Tests use MockEngine; integration tests with real embeddings are separate.

2. **Path dependency portability**: `gg-core = { path = "G:/mythologiq/GG/GG-CORE/core-runtime" }` is machine-specific. **Decision**: Feature-gated (`ggcore` feature). The crate builds without GG-CORE by default. CI/collaborators don't need the path.

---

## Phase 1: Feature Flag & GgCoreEngine Adapter

### Affected Files

- `crates/evolve-core/Cargo.toml` — Add `gg-core` optional dependency + `ggcore` feature
- `Cargo.toml` (workspace) — Add gg-core to workspace dependencies
- `crates/evolve-core/src/representation/ggcore.rs` — NEW: GG-CORE engine adapter
- `crates/evolve-core/src/representation/mod.rs` — Conditionally include ggcore module

### Changes

**Cargo.toml (workspace root)** — add to `[workspace.dependencies]`:

```toml
gg-core = { path = "G:/mythologiq/GG/GG-CORE/core-runtime", features = ["onnx"], optional = true }
async-trait = "0.1"
```

**crates/evolve-core/Cargo.toml** — add:

```toml
[dependencies]
# ... existing deps ...
gg-core = { workspace = true, optional = true }
async-trait = { workspace = true, optional = true }

[features]
default = []
ggcore = ["gg-core", "async-trait"]
```

Note: `async-trait` is needed because GG-CORE's `OnnxModel` trait uses `#[async_trait]`, so our adapter must match.

**crates/evolve-core/src/representation/ggcore.rs**:

```rust
//! GG-CORE engine adapter — wraps OnnxEmbedder for the RepresentationEngine trait.

use crate::representation::types::*;
use crate::representation::engine::{EngineError, RepresentationEngine};
use gg_core::engine::onnx::OnnxEmbedder;
use gg_core::engine::input::InferenceInput;
use gg_core::engine::config::InferenceConfig;
use gg_core::engine::output::InferenceOutput;
use gg_core::engine::onnx::OnnxModel;

/// GG-CORE backed engine using ONNX embeddings via Candle.
pub struct GgCoreEngine {
    embedder: OnnxEmbedder,
    model_id: String,
    dimensions: usize,
    capabilities: EngineCapabilities,
}

impl GgCoreEngine {
    /// Create from an initialized OnnxEmbedder.
    pub fn new(embedder: OnnxEmbedder, dimensions: usize) -> Self {
        let model_id = embedder.model_id().to_string();
        Self {
            embedder,
            model_id,
            dimensions,
            capabilities: EngineCapabilities {
                supported_strategies: vec![
                    SimilarityStrategy::Cosine,
                    SimilarityStrategy::Euclidean,
                    SimilarityStrategy::DotProduct,
                ],
                supports_batch: true,
                supports_quantization: false,
                supports_cross_model: false,
            },
        }
    }
}

impl RepresentationEngine for GgCoreEngine {
    fn model_id(&self) -> &str { &self.model_id }
    fn capabilities(&self) -> &EngineCapabilities { &self.capabilities }

    async fn encode(&self, content: &str) -> Result<Representation, EngineError> {
        let input = InferenceInput::Text(content.to_string());
        let config = InferenceConfig::for_embedding();
        let output = self.embedder.infer(&input, &config).await
            .map_err(|e| EngineError::EncodingFailed(e.to_string()))?;

        match output {
            InferenceOutput::Embedding(result) => {
                Ok(Representation::from_vector(&self.model_id, result.vector))
            }
            _ => Err(EngineError::EncodingFailed("unexpected output type".into())),
        }
    }

    async fn encode_batch(&self, contents: &[&str]) -> Result<Vec<Representation>, EngineError> {
        let texts: Vec<String> = contents.iter().map(|s| s.to_string()).collect();
        let input = InferenceInput::TextBatch(texts);
        let config = InferenceConfig::for_embedding();
        let output = self.embedder.infer(&input, &config).await
            .map_err(|e| EngineError::EncodingFailed(e.to_string()))?;

        // GG-CORE returns single Embedding for batch — split by dimensions
        match output {
            InferenceOutput::Embedding(result) => {
                let chunks: Vec<Representation> = result.vector
                    .chunks(self.dimensions)
                    .map(|chunk| Representation::from_vector(&self.model_id, chunk.to_vec()))
                    .collect();
                Ok(chunks)
            }
            _ => Err(EngineError::EncodingFailed("unexpected output type".into())),
        }
    }

    fn similarity(&self, a: &Representation, b: &Representation, strategy: SimilarityStrategy) -> f32 {
        let va = a.as_vector();
        let vb = b.as_vector();
        match strategy {
            SimilarityStrategy::Cosine => crate::representation::similarity::cosine_similarity(&va, &vb),
            SimilarityStrategy::Euclidean => {
                let d = crate::representation::similarity::euclidean_distance(&va, &vb);
                crate::representation::similarity::euclidean_to_similarity(d)
            }
            SimilarityStrategy::DotProduct => crate::representation::similarity::dot_product(&va, &vb),
        }
    }

    fn cross_model_similarity(&self, a: &Representation, b: &Representation) -> CrossModelResult {
        if a.model_id != b.model_id {
            return CrossModelResult { score: 0.0, degraded: true, reason: Some("cross-model not supported".into()) };
        }
        CrossModelResult { score: self.similarity(a, b, SimilarityStrategy::Cosine), degraded: false, reason: None }
    }

    fn serialize(&self, rep: &Representation) -> Vec<u8> { rep.bytes.clone() }

    fn deserialize(&self, bytes: &[u8]) -> Result<Representation, EngineError> {
        Representation::from_bytes(bytes).map_err(|e| EngineError::DeserializationFailed(e))
    }

    fn is_native(&self, rep: &Representation) -> bool { rep.model_id == self.model_id }
}
```

**crates/evolve-core/src/representation/mod.rs** — conditional include:

```rust
#[cfg(feature = "ggcore")]
pub mod ggcore;
```

### Unit Tests

Tests for GgCoreEngine require the `ggcore` feature and a working GG-CORE runtime. These are gated:

- `crates/evolve-core/src/representation/tests.rs` (append, `#[cfg(feature = "ggcore")]`)
  - `test_ggcore_engine_model_id` — Engine reports correct model ID
  - `test_ggcore_engine_capabilities` — Capabilities include expected strategies

---

## Phase 2: Engine Factory

### Affected Files

- `crates/evolve-core/src/representation/factory.rs` — NEW: Engine creation factory
- `crates/evolve-core/src/representation/mod.rs` — Add `pub mod factory;`

### Changes

**crates/evolve-core/src/representation/factory.rs**:

```rust
use crate::representation::engine::RepresentationEngine;
use crate::representation::mock::MockEngine;

/// Engine type selector.
#[derive(Clone, Debug)]
pub enum EngineType {
    Mock { dimensions: usize },
    #[cfg(feature = "ggcore")]
    GgCore { model_id: String, dimensions: usize },
}

impl Default for EngineType {
    fn default() -> Self { Self::Mock { dimensions: 384 } }
}

/// Create a mock engine (always available).
pub fn create_mock_engine(dimensions: usize) -> MockEngine {
    MockEngine::new(dimensions)
}

/// Create a GG-CORE engine (requires ggcore feature + initialized OnnxEmbedder).
#[cfg(feature = "ggcore")]
pub fn create_ggcore_engine(
    embedder: gg_core::engine::onnx::OnnxEmbedder,
    dimensions: usize,
) -> crate::representation::ggcore::GgCoreEngine {
    crate::representation::ggcore::GgCoreEngine::new(embedder, dimensions)
}
```

### Unit Tests

- `crates/evolve-core/src/representation/tests.rs` (append)
  - `test_create_mock_engine` — Factory creates working mock engine
  - `test_engine_type_default` — Default is Mock with 384 dimensions

---

## Summary

| Phase | Focus | New Files | Changes |
|-------|-------|-----------|---------|
| 1 | Feature flag + GgCoreEngine adapter | 1 new | 3 modified (Cargo.toml x2, mod.rs) |
| 2 | Engine factory | 1 new | 1 modified (mod.rs) |

### Design Principles Applied

1. **Simple over Easy**: Feature flag — crate builds without GG-CORE by default
2. **Composable**: GgCoreEngine implements the same RepresentationEngine trait as MockEngine
3. **No complecting**: Adapter wraps GG-CORE types, doesn't leak them into the rest of the crate
4. **Declarative**: `EngineType` enum declares intent, factory functions create engines

---

_Plan follows Simple Made Easy principles_
