//! GG-CORE engine adapter — wraps OnnxEmbedder as a RepresentationEngine.

use crate::representation::engine::{EngineError, RepresentationEngine};
use crate::representation::similarity;
use crate::representation::types::*;
use gg_core::engine::config::InferenceConfig;
use gg_core::engine::input::InferenceInput;
use gg_core::engine::onnx::{OnnxEmbedder, OnnxModel};
use gg_core::engine::output::InferenceOutput;

/// GG-CORE backed engine using ONNX embeddings via Candle.
pub struct GgCoreEngine {
    embedder: OnnxEmbedder,
    model_id: String,
    #[allow(dead_code)]
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

    /// Embedding inference config (deterministic, fast timeout).
    fn embedding_config() -> InferenceConfig {
        InferenceConfig {
            max_tokens: None,
            temperature: 0.0,
            timeout_ms: 2000,
            ..InferenceConfig::default()
        }
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
        let input = InferenceInput::Text(content.to_string());
        let output = self.embedder.infer(&input, &Self::embedding_config()).await
            .map_err(|e| EngineError::EncodingFailed(e.to_string()))?;

        match output {
            InferenceOutput::Embedding(r) => Ok(Representation::from_vector(&self.model_id, r.vector)),
            _ => Err(EngineError::EncodingFailed("unexpected output type".into())),
        }
    }

    async fn encode_batch(&self, contents: &[&str]) -> Result<Vec<Representation>, EngineError> {
        // GG-CORE batch returns single result; encode individually for now
        let mut results = Vec::with_capacity(contents.len());
        for content in contents {
            results.push(self.encode(content).await?);
        }
        Ok(results)
    }

    fn similarity(&self, a: &Representation, b: &Representation, strategy: SimilarityStrategy) -> f32 {
        let va = a.as_vector();
        let vb = b.as_vector();
        match strategy {
            SimilarityStrategy::Cosine => similarity::cosine_similarity(&va, &vb),
            SimilarityStrategy::Euclidean => {
                similarity::euclidean_to_similarity(similarity::euclidean_distance(&va, &vb))
            }
            SimilarityStrategy::DotProduct => similarity::dot_product(&va, &vb),
        }
    }

    fn cross_model_similarity(&self, a: &Representation, b: &Representation) -> CrossModelResult {
        if a.model_id != b.model_id {
            return CrossModelResult {
                score: 0.0,
                degraded: true,
                reason: Some("cross-model not supported".into()),
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
        Representation::from_bytes(bytes).map_err(|e| EngineError::DeserializationFailed(e))
    }

    fn is_native(&self, rep: &Representation) -> bool {
        rep.model_id == self.model_id
    }
}
