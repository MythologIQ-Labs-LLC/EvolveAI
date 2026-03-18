/**
 * Similarity Functions
 * Pure vector similarity computations for Float32Array
 */

/**
 * Cosine similarity between two vectors
 * Returns value in range [-1, 1], typically [0, 1] for embeddings
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Euclidean distance between two vectors
 * Returns value >= 0, smaller is more similar
 */
export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Dot product of two vectors
 * Fast when vectors are normalized
 */
export function dotProduct(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }

  return sum;
}

/**
 * Convert euclidean distance to similarity score [0, 1]
 * Uses exponential decay: similarity = e^(-distance)
 */
export function euclideanToSimilarity(distance: number): number {
  return Math.exp(-distance);
}

/**
 * Normalize a vector to unit length
 */
export function normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) {
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm);

  if (norm === 0) return v;

  const result = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) {
    result[i] = v[i] / norm;
  }

  return result;
}
