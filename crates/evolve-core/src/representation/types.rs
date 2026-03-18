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

impl Representation {
    /// Create from a float vector (header: model_id length as u16 + model_id bytes + version byte)
    pub fn from_vector(model_id: &str, vector: Vec<f32>) -> Self {
        let mut bytes = Vec::new();
        let model_bytes = model_id.as_bytes();
        bytes.extend_from_slice(&(model_bytes.len() as u16).to_le_bytes());
        bytes.extend_from_slice(model_bytes);
        bytes.push(1); // version
        for f in &vector {
            bytes.extend_from_slice(&f.to_le_bytes());
        }
        Self {
            bytes,
            model_id: model_id.to_string(),
            version: 1,
        }
    }

    /// Extract float vector from bytes
    pub fn as_vector(&self) -> Vec<f32> {
        let model_len = u16::from_le_bytes([self.bytes[0], self.bytes[1]]) as usize;
        let data_start = 2 + model_len + 1; // u16 + model + version
        self.bytes[data_start..]
            .chunks_exact(4)
            .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect()
    }

    /// Dimensions of the vector
    pub fn dimensions(&self) -> usize {
        self.as_vector().len()
    }

    /// Reconstruct from raw bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() < 3 {
            return Err("Bytes too short".into());
        }
        let model_len = u16::from_le_bytes([bytes[0], bytes[1]]) as usize;
        if bytes.len() < 2 + model_len + 1 {
            return Err("Invalid byte layout".into());
        }
        let model_id = String::from_utf8(bytes[2..2 + model_len].to_vec())
            .map_err(|e| e.to_string())?;
        let version = bytes[2 + model_len];
        Ok(Self {
            bytes: bytes.to_vec(),
            model_id,
            version,
        })
    }
}

/// Similarity computation strategy
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
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
