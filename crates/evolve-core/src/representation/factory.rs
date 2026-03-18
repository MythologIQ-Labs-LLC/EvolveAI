use crate::representation::mock::MockEngine;

/// Engine type selector.
#[derive(Clone, Debug)]
pub enum EngineType {
    /// Hash-based mock engine for testing.
    Mock { dimensions: usize },
    /// GG-CORE ONNX engine (requires `ggcore` feature).
    #[cfg(feature = "ggcore")]
    GgCore { model_id: String, dimensions: usize },
}

impl Default for EngineType {
    fn default() -> Self {
        Self::Mock { dimensions: 384 }
    }
}

/// Create a mock engine (always available).
pub fn create_mock_engine(dimensions: usize) -> MockEngine {
    MockEngine::new(dimensions)
}

/// Create a GG-CORE engine from an initialized OnnxEmbedder.
#[cfg(feature = "ggcore")]
pub fn create_ggcore_engine(
    embedder: gg_core::engine::onnx::OnnxEmbedder,
    dimensions: usize,
) -> crate::representation::ggcore::GgCoreEngine {
    crate::representation::ggcore::GgCoreEngine::new(embedder, dimensions)
}
