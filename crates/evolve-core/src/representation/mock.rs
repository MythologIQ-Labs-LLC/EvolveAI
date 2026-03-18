use crate::representation::types::{
    CrossModelResult, EngineCapabilities, Representation, SimilarityStrategy,
};
use crate::representation::engine::{EngineError, RepresentationEngine};
use sha2::{Digest, Sha256};

/// Mock engine for testing - generates hash-based representations
pub struct MockEngine {
    model_id: String,
    dimensions: usize,
    capabilities: EngineCapabilities,
}

impl MockEngine {
    pub fn new(dimensions: usize) -> Self {
        Self {
            model_id: "mock-engine".to_string(),
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

    fn hash_to_vector(&self, content: &str) -> Vec<f32> {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        let hash = hasher.finalize();

        let mut vector = Vec::with_capacity(self.dimensions);
        for i in 0..self.dimensions {
            let byte_idx = i % hash.len();
            vector.push((hash[byte_idx] as f32 / 255.0) * 2.0 - 1.0);
        }
        vector
    }
}

impl RepresentationEngine for MockEngine {
    fn model_id(&self) -> &str {
        &self.model_id
    }

    fn capabilities(&self) -> &EngineCapabilities {
        &self.capabilities
    }

    async fn encode(&self, content: &str) -> Result<Representation, EngineError> {
        let vector = self.hash_to_vector(content);
        Ok(Representation::from_vector(&self.model_id, vector))
    }

    async fn encode_batch(&self, contents: &[&str]) -> Result<Vec<Representation>, EngineError> {
        let mut results = Vec::with_capacity(contents.len());
        for content in contents {
            results.push(self.encode(content).await?);
        }
        Ok(results)
    }

    fn similarity(
        &self,
        a: &Representation,
        b: &Representation,
        strategy: SimilarityStrategy,
    ) -> f32 {
        let vec_a = a.as_vector();
        let vec_b = b.as_vector();

        match strategy {
            SimilarityStrategy::Cosine => {
                crate::representation::similarity::cosine_similarity(&vec_a, &vec_b)
            }
            SimilarityStrategy::Euclidean => {
                let dist = crate::representation::similarity::euclidean_distance(&vec_a, &vec_b);
                crate::representation::similarity::euclidean_to_similarity(dist)
            }
            SimilarityStrategy::DotProduct => {
                crate::representation::similarity::dot_product(&vec_a, &vec_b)
            }
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
            .map_err(|e| EngineError::DeserializationFailed(e))
    }

    fn is_native(&self, rep: &Representation) -> bool {
        rep.model_id == self.model_id
    }
}
