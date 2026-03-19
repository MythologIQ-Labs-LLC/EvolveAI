/// Formal SLO thresholds for memory system reliability.
#[derive(Clone, Debug)]
pub struct SloThresholds {
    pub max_query_latency_ms: u64,
    pub max_l3_latency_ms: u64,
    pub chain_integrity_required: bool,
    pub max_violation_rate: f32,
    pub window_size: usize,
}

impl Default for SloThresholds {
    fn default() -> Self {
        Self {
            max_query_latency_ms: 50,
            max_l3_latency_ms: 1,
            chain_integrity_required: true,
            max_violation_rate: 0.01,
            window_size: 100,
        }
    }
}

/// A single SLO measurement from a query.
#[derive(Clone, Debug)]
pub struct SloSample {
    pub latency_ms: u64,
    pub was_l3_direct: bool,
    pub chain_valid: bool,
}

/// SLO evaluation result.
#[derive(Clone, Debug)]
pub struct SloReport {
    pub violations: Vec<SloViolation>,
    pub total_samples: usize,
    pub violation_count: usize,
    pub violation_rate: f32,
    pub budget_remaining: f32,
    pub circuit_open: bool,
}

/// A specific SLO violation.
#[derive(Clone, Debug)]
pub enum SloViolation {
    LatencyExceeded { actual_ms: u64, limit_ms: u64 },
    L3LatencyExceeded { actual_ms: u64, limit_ms: u64 },
    ChainIntegrityFailed,
}

/// Rolling window SLO tracker.
pub struct SloTracker {
    thresholds: SloThresholds,
    samples: Vec<SloSample>,
    circuit_open: bool,
}

impl SloTracker {
    pub fn new(thresholds: SloThresholds) -> Self {
        Self {
            thresholds,
            samples: Vec::new(),
            circuit_open: false,
        }
    }

    /// Record a query sample and return current SLO report.
    pub fn record(&mut self, sample: SloSample) -> SloReport {
        self.samples.push(sample);
        if self.samples.len() > self.thresholds.window_size {
            self.samples.remove(0);
        }
        let report = self.evaluate();
        if report.budget_remaining <= 0.0 {
            self.circuit_open = true;
        }
        report
    }

    /// Evaluate current window against thresholds.
    pub fn evaluate(&self) -> SloReport {
        let mut violations = Vec::new();
        let mut violation_count = 0_usize;

        for s in &self.samples {
            if self.check_sample(s, &mut violations) {
                violation_count += 1;
            }
        }

        let total = self.samples.len();
        let rate = if total > 0 { violation_count as f32 / total as f32 } else { 0.0 };
        let budget = if self.thresholds.max_violation_rate > 0.0 {
            ((self.thresholds.max_violation_rate - rate) / self.thresholds.max_violation_rate).max(0.0)
        } else {
            if violation_count > 0 { 0.0 } else { 1.0 }
        };

        SloReport {
            violations,
            total_samples: total,
            violation_count,
            violation_rate: rate,
            budget_remaining: budget,
            circuit_open: self.circuit_open,
        }
    }

    /// Manually reset the circuit breaker.
    pub fn reset_circuit(&mut self) {
        self.circuit_open = false;
        self.samples.clear();
    }

    fn check_sample(&self, s: &SloSample, violations: &mut Vec<SloViolation>) -> bool {
        let mut violated = false;
        if s.was_l3_direct && s.latency_ms > self.thresholds.max_l3_latency_ms {
            violations.push(SloViolation::L3LatencyExceeded {
                actual_ms: s.latency_ms,
                limit_ms: self.thresholds.max_l3_latency_ms,
            });
            violated = true;
        } else if !s.was_l3_direct && s.latency_ms > self.thresholds.max_query_latency_ms {
            violations.push(SloViolation::LatencyExceeded {
                actual_ms: s.latency_ms,
                limit_ms: self.thresholds.max_query_latency_ms,
            });
            violated = true;
        }
        if self.thresholds.chain_integrity_required && !s.chain_valid {
            violations.push(SloViolation::ChainIntegrityFailed);
            violated = true;
        }
        violated
    }
}
