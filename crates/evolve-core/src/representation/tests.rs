use super::*;
use crate::representation::mock::MockEngine;
use crate::representation::engine::RepresentationEngine;

#[test]
fn test_cosine_similarity_identical_vectors() {
    let v = vec![1.0, 2.0, 3.0];
    let result = cosine_similarity(&v, &v);
    assert!((result - 1.0).abs() < 1e-6);
}

#[test]
fn test_cosine_similarity_orthogonal() {
    let a = vec![1.0, 0.0];
    let b = vec![0.0, 1.0];
    let result = cosine_similarity(&a, &b);
    assert!(result.abs() < 1e-6);
}

#[test]
fn test_cosine_similarity_zero_vector() {
    let a = vec![0.0, 0.0, 0.0];
    let b = vec![1.0, 2.0, 3.0];
    let result = cosine_similarity(&a, &b);
    assert_eq!(result, 0.0);
}

#[test]
fn test_euclidean_distance_same_point() {
    let v = vec![1.0, 2.0, 3.0];
    let result = euclidean_distance(&v, &v);
    assert!(result.abs() < 1e-6);
}

#[test]
fn test_euclidean_to_similarity_zero_distance() {
    assert!((euclidean_to_similarity(0.0) - 1.0).abs() < 1e-6);
}

#[test]
fn test_dot_product_calculation() {
    let a = vec![1.0, 2.0, 3.0];
    let b = vec![4.0, 5.0, 6.0];
    let result = dot_product(&a, &b);
    assert!((result - 32.0).abs() < 1e-6);
}

#[test]
fn test_representation_from_vector_roundtrip() {
    let vector = vec![1.0, 2.0, 3.0, 4.0];
    let rep = Representation::from_vector("test-model", vector.clone());
    let extracted = rep.as_vector();
    assert_eq!(extracted.len(), vector.len());
    for (a, b) in extracted.iter().zip(vector.iter()) {
        assert!((a - b).abs() < 1e-6);
    }
}

#[test]
fn test_representation_from_bytes_roundtrip() {
    let vector = vec![1.5, 2.5, 3.5];
    let rep = Representation::from_vector("test", vector);
    let bytes = rep.bytes.clone();
    let restored = Representation::from_bytes(&bytes).unwrap();
    assert_eq!(restored.model_id, "test");
    assert_eq!(restored.version, 1);
    assert_eq!(restored.as_vector(), rep.as_vector());
}

#[test]
fn test_representation_dimensions() {
    let rep = Representation::from_vector("m", vec![0.0; 384]);
    assert_eq!(rep.dimensions(), 384);
}

#[tokio::test]
async fn test_mock_engine_encode() {
    let engine = MockEngine::new(64);
    let rep = engine.encode("hello world").await.unwrap();
    assert_eq!(rep.model_id, "mock-engine");
    assert_eq!(rep.dimensions(), 64);
}

#[tokio::test]
async fn test_mock_engine_deterministic() {
    let engine = MockEngine::new(32);
    let r1 = engine.encode("test").await.unwrap();
    let r2 = engine.encode("test").await.unwrap();
    assert_eq!(r1.as_vector(), r2.as_vector());
}

#[tokio::test]
async fn test_mock_engine_similarity_identical() {
    let engine = MockEngine::new(64);
    let rep = engine.encode("hello").await.unwrap();
    let score = engine.similarity(&rep, &rep, SimilarityStrategy::Cosine);
    assert!((score - 1.0).abs() < 1e-6);
}

#[tokio::test]
async fn test_mock_engine_batch_encode() {
    let engine = MockEngine::new(32);
    let reps = engine.encode_batch(&["a", "b", "c"]).await.unwrap();
    assert_eq!(reps.len(), 3);
}

#[tokio::test]
async fn test_mock_engine_serialization_roundtrip() {
    let engine = MockEngine::new(32);
    let rep = engine.encode("test data").await.unwrap();
    let serialized = engine.serialize(&rep);
    let deserialized = engine.deserialize(&serialized).unwrap();
    assert_eq!(rep.as_vector(), deserialized.as_vector());
}

#[test]
fn test_create_mock_engine_via_factory() {
    let engine = crate::representation::factory::create_mock_engine(256);
    assert_eq!(engine.model_id(), "mock-engine");
}

#[test]
fn test_engine_type_default() {
    let engine_type = crate::representation::factory::EngineType::default();
    assert!(matches!(engine_type, crate::representation::factory::EngineType::Mock { dimensions: 384 }));
}
