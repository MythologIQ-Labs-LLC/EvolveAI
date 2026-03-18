use crate::representation::types::{
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
    #[error("encoding failed: {0}")]
    EncodingFailed(String),
    #[error("deserialization failed: {0}")]
    DeserializationFailed(String),
    #[error("model not initialized")]
    NotInitialized,
}
