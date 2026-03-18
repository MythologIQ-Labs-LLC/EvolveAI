/// Context temperature derived from saturation.
/// T_ctx = (1 - σ) × ln(2)
/// At σ=0: T_ctx = ln(2) (maximum temperature, fastest decay)
/// At σ=1: T_ctx = 0 (ground state, no decay)
pub fn temperature(saturation: f32) -> f32 {
    (1.0 - saturation.clamp(0.0, 1.0)) * std::f32::consts::LN_2
}

/// Effective decay constant: λ_eff = λ_base × T_ctx
/// Saturated memories (σ=1) have λ_eff = 0 (no decay).
pub fn effective_lambda(base_lambda: f32, saturation: f32) -> f32 {
    base_lambda * temperature(saturation)
}

/// Thermodynamic CMHL decay.
/// w_current = e^(-λ_eff × elapsed)
pub fn calculate_decay(
    last_accessed: i64,
    current_time: i64,
    half_life_ms: i64,
    saturation: f32,
) -> f32 {
    let elapsed = current_time - last_accessed;
    if elapsed <= 0 {
        return 1.0;
    }

    let base_lambda = std::f32::consts::LN_2 / half_life_ms as f32;
    let lambda_eff = effective_lambda(base_lambda, saturation);

    (-lambda_eff * elapsed as f32).exp()
}

/// Check if a memory should be pruned based on its decay weight.
pub fn should_prune(decay_weight: f32, threshold: f32) -> bool {
    decay_weight < threshold
}

/// Increase saturation based on access.
/// Each access pins conceptual fibers, increasing σ toward 1.0.
/// σ' = 1 - (1 - σ) × e^(-boost_rate × accesses)
pub fn boost_saturation(current: f32, access_count: u32, boost_rate: f32) -> f32 {
    let remaining = 1.0 - current;
    let pinned = remaining * (1.0 - (-boost_rate * access_count as f32).exp());
    (current + pinned).min(1.0)
}
