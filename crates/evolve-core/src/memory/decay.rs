/// CMHL (Continuous Memory Half-Life) decay calculation.
///
/// Implements lazy exponential decay based on time since last access.
/// Returns `base_factor` unchanged when elapsed time is zero or negative.
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

/// Check if a memory should be pruned based on its decay factor.
pub fn should_prune(decay_factor: f32, threshold: f32) -> bool {
    decay_factor < threshold
}

/// Calculate effective strength with access-count boost.
///
/// The boost is capped so that highly-accessed memories gain at most
/// a 3x multiplier, and the final strength never exceeds 1.0.
pub fn effective_strength(decay_factor: f32, access_count: u32, boost_factor: f32) -> f32 {
    let boost = 1.0 + (access_count as f32 * boost_factor).min(2.0);
    (decay_factor * boost).min(1.0)
}
