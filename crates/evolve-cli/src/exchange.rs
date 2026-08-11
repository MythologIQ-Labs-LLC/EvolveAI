//! Memory Exchange Envelope v1.0.0.
//!
//! Implements export/import of the envelope defined normatively by
//! `schemas/memory-exchange.schema.json` and documented in
//! `docs/INTEROP.md` §3. Validation is hand-rolled (serde closed structs +
//! semantic checks) — no schema-validation dependency.
//!
//! Doctrine boundaries honored here (INTEROP.md §3.4):
//! - authority does not transit: imported tier/state/σ/trust are evidence,
//!   not instructions — every imported unit enters L2 as a proposal with
//!   locally re-derived trust and saturation, never directly into L3;
//! - identity is verified where possible: units carrying `content` must
//!   BLAKE3-match their address or the whole envelope is rejected;
//! - rejection is whole, never partial repair;
//! - unknown schema_version majors are not processed.
//!
//! Verifying a foreign ledger chain is out of scope: the attestation block
//! is required structurally, but its hashes are not recomputed.

use evolve_core::memory::decay::{calculate_decay, should_prune};
use evolve_core::memory::decoder::DecoderConfig;
use evolve_core::memory::types::{MemoryUnit, Tier, TrustLevel, UnitMetadata, UorAddress};
use evolve_core::processor::slo::SloReport;
use evolve_core::processor::trust::CRYSTALLIZATION_THRESHOLD;
use evolve_core::processor::types::Snapshot;
use serde::{Deserialize, Serialize};

/// Exchange contract version this implementation speaks.
pub const EXCHANGE_VERSION: &str = "1.0.0";

const SCORE_KIND: &str = "lifecycle_routing_score";
const DECAY_MODEL: &str = "cmhl_thermodynamic";
const DOCTRINE_REF: &str = "MythologIQ-Labs-LLC/agent-memory";

const VALID_TIERS: [&str; 3] = ["L1", "L2", "L3"];
const VALID_STATES: [&str; 10] = [
    "transient",
    "observed",
    "linked",
    "reinforced",
    "candidate",
    "pending_verification",
    "crystallized",
    "stale",
    "disputed",
    "pruned",
];
const VALID_TRUST_LEVELS: [&str; 3] = ["unverified", "user_reviewed", "verified"];

// ---------------------------------------------------------------------------
// Envelope types (closed objects, mirroring the schema)
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Envelope {
    pub schema_version: String,
    pub exporter: Exporter,
    pub attestation: Attestation,
    pub memories: Vec<ExchangeUnit>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Exporter {
    pub implementation: String,
    pub version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub doctrine_ref: Option<String>,
    pub exported_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Attestation {
    pub ledger_head: LedgerHead,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub genesis_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chain_length: Option<u64>,
    pub content_address_algorithm: String,
    pub block_hash_algorithm: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chain_verified_at_export: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LedgerHead {
    pub index: u64,
    pub hash: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExchangeUnit {
    pub address: String,
    /// Explicitly serialized even when null: evolve-core does not retain raw
    /// content, and the schema forces that honesty.
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    pub tier: String,
    pub state: String,
    pub saturation: Saturation,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decay: Option<DecayBlock>,
    pub trust: TrustBlock,
    pub provenance: Provenance,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_accessed_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub access_count: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mts_score: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edges: Option<Vec<ExchangeEdge>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ledger_ref: Option<LedgerRef>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Saturation {
    pub sigma: f32,
    pub score_kind: String,
    pub calibrated: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crystallization_threshold: Option<f32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DecayBlock {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub half_life_ms: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pressure: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decayed_weight_at_export: Option<f32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TrustBlock {
    pub level: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub initial_saturation: Option<f32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Provenance {
    pub origin: String,
    pub observer: String,
    pub method: String,
    pub timestamp: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_refs: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExchangeEdge {
    pub target: String,
    pub weight: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LedgerRef {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block_index: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data_hash: Option<String>,
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/// Build a schema-conformant envelope from a persisted state snapshot.
///
/// L1 is intentionally absent: it is ephemeral and never persisted, so a
/// CLI invocation only ever sees L2 and L3 state.
pub fn build_envelope(
    snap: &Snapshot,
    slo: &SloReport,
    chain_verified: bool,
    now_ms: i64,
    exporter_version: &str,
) -> Result<Envelope, String> {
    let blocks = &snap.l3_blocks;
    let head = blocks
        .last()
        .ok_or("cannot export: ledger has no blocks (not even genesis)")?;
    let genesis = blocks.first().expect("non-empty checked above");

    let half_life_ms = slo.adjusted_half_life_ms.max(1);
    let pressure = clamp01(slo.pressure);
    let decay_threshold = DecoderConfig::default().decay_threshold;

    let mut memories: Vec<ExchangeUnit> = Vec::new();
    for unit in &snap.l2_nodes {
        let edges = snap
            .l2_edges
            .get(&unit.address)
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let state = classify_l2_state(
            unit,
            !edges.is_empty(),
            half_life_ms,
            decay_threshold,
            now_ms,
        );
        let exchange_edges = edges
            .iter()
            .map(|e| ExchangeEdge {
                target: e.target.0.clone(),
                weight: e.weight,
                created_at: Some(rfc3339(e.created_at)),
            })
            .collect();
        memories.push(unit_to_exchange(
            unit,
            "L2",
            state,
            exchange_edges,
            None,
            half_life_ms,
            pressure,
            now_ms,
        ));
    }
    for unit in &snap.l3_entries {
        let ledger_ref = find_ledger_ref(snap, &unit.address);
        memories.push(unit_to_exchange(
            unit,
            "L3",
            "crystallized",
            Vec::new(),
            ledger_ref,
            half_life_ms,
            pressure,
            now_ms,
        ));
    }
    // HashMap iteration order is nondeterministic; sort for stable exports.
    memories.sort_by(|a, b| (&a.created_at, &a.address).cmp(&(&b.created_at, &b.address)));

    Ok(Envelope {
        schema_version: EXCHANGE_VERSION.to_string(),
        exporter: Exporter {
            implementation: "evolve-cli".to_string(),
            version: exporter_version.to_string(),
            snapshot_version: Some(snap.version.clone()),
            doctrine_ref: Some(DOCTRINE_REF.to_string()),
            exported_at: rfc3339(now_ms),
        },
        attestation: Attestation {
            ledger_head: LedgerHead {
                index: head.index,
                hash: head.hash.clone(),
                timestamp: Some(head.timestamp),
            },
            genesis_hash: Some(genesis.hash.clone()),
            chain_length: Some(blocks.len() as u64),
            content_address_algorithm: "blake3".to_string(),
            block_hash_algorithm: "sha256".to_string(),
            chain_verified_at_export: Some(chain_verified),
        },
        memories,
    })
}

/// INTEROP.md §3.3 mapping for an L2 unit (derivable subset).
fn classify_l2_state(
    unit: &MemoryUnit,
    has_edges: bool,
    half_life_ms: i64,
    decay_threshold: f32,
    now_ms: i64,
) -> &'static str {
    if unit.saturation >= CRYSTALLIZATION_THRESHOLD {
        return "candidate";
    }
    let weight = calculate_decay(unit.last_accessed, now_ms, half_life_ms, unit.saturation);
    if should_prune(weight, decay_threshold) {
        return "stale";
    }
    if has_edges {
        "linked"
    } else {
        "observed"
    }
}

#[allow(clippy::too_many_arguments)]
fn unit_to_exchange(
    unit: &MemoryUnit,
    tier: &str,
    state: &str,
    edges: Vec<ExchangeEdge>,
    ledger_ref: Option<LedgerRef>,
    half_life_ms: i64,
    pressure: f32,
    now_ms: i64,
) -> ExchangeUnit {
    let weight = calculate_decay(unit.last_accessed, now_ms, half_life_ms, unit.saturation);
    let mut tags = unit.metadata.tags.clone();
    tags.sort();
    tags.dedup();
    let source = unit.metadata.source.clone();
    ExchangeUnit {
        address: unit.address.0.clone(),
        // evolve-core stores only the embedding — content is honestly null.
        content: None,
        content_type: None,
        tier: tier.to_string(),
        state: state.to_string(),
        saturation: Saturation {
            sigma: clamp01(unit.saturation),
            score_kind: SCORE_KIND.to_string(),
            calibrated: false,
            crystallization_threshold: Some(CRYSTALLIZATION_THRESHOLD),
        },
        decay: Some(DecayBlock {
            model: Some(DECAY_MODEL.to_string()),
            half_life_ms: Some(half_life_ms),
            pressure: Some(pressure),
            decayed_weight_at_export: Some(clamp01(weight)),
        }),
        // TrustLevel is not retained on stored units, so the exporter can
        // only honestly declare "unverified".
        trust: TrustBlock {
            level: "unverified".to_string(),
            initial_saturation: None,
        },
        provenance: Provenance {
            origin: source.clone().unwrap_or_else(|| "unknown".to_string()),
            observer: "evolve-core/encoder".to_string(),
            method: if source.is_some() {
                "file_ingest".to_string()
            } else {
                "cli_add".to_string()
            },
            timestamp: rfc3339(unit.created_at),
            source_refs: None,
        },
        created_at: rfc3339(unit.created_at),
        last_accessed_at: Some(rfc3339(unit.last_accessed)),
        access_count: Some(u64::from(unit.access_count)),
        tags: Some(tags),
        mts_score: Some(clamp01(unit.metadata.mts_score)),
        edges: Some(edges),
        ledger_ref,
    }
}

/// Find the most recent ledger block recording this unit (structured
/// `op:address:content-hash` entries; legacy bare-hash and genesis blocks
/// cannot be attributed and yield no ledger_ref).
fn find_ledger_ref(snap: &Snapshot, addr: &UorAddress) -> Option<LedgerRef> {
    snap.l3_blocks.iter().rev().find_map(|block| {
        let mut parts = block.data_hash.splitn(3, ':');
        let _op = parts.next()?;
        let entry_addr = parts.next()?;
        let content_hash = parts.next()?;
        if entry_addr == addr.0 && is_hex64(content_hash) {
            Some(LedgerRef {
                block_index: Some(block.index),
                block_hash: Some(block.hash.clone()),
                data_hash: Some(content_hash.to_string()),
            })
        } else {
            None
        }
    })
}

// ---------------------------------------------------------------------------
// Import: validation
// ---------------------------------------------------------------------------

/// Parse and validate an envelope. Whole-envelope rejection with a reason —
/// never partial repair (INTEROP.md §3.4 rule 4).
pub fn parse_and_validate(json_text: &str) -> Result<Envelope, String> {
    let value: serde_json::Value =
        serde_json::from_str(json_text).map_err(|e| format!("invalid JSON: {e}"))?;
    let obj = value
        .as_object()
        .ok_or_else(|| "envelope must be a JSON object".to_string())?;
    if !obj.contains_key("attestation") {
        return Err("attestation block is missing (structurally required)".to_string());
    }
    for key in ["schema_version", "exporter", "memories"] {
        if !obj.contains_key(key) {
            return Err(format!("required field '{key}' is missing"));
        }
    }
    let envelope: Envelope =
        serde_json::from_value(value).map_err(|e| format!("schema violation: {e}"))?;
    validate(&envelope)?;
    Ok(envelope)
}

fn validate(env: &Envelope) -> Result<(), String> {
    let (major, _, _) = parse_semver(&env.schema_version)
        .ok_or_else(|| format!("schema_version '{}' is not semver", env.schema_version))?;
    let (own_major, _, _) = parse_semver(EXCHANGE_VERSION).expect("own version is semver");
    if major != own_major {
        return Err(format!(
            "unsupported schema_version '{}' (this importer speaks {}.x)",
            env.schema_version, own_major
        ));
    }

    let att = &env.attestation;
    if att.content_address_algorithm != "blake3" {
        return Err(format!(
            "unsupported content_address_algorithm '{}'",
            att.content_address_algorithm
        ));
    }
    if att.block_hash_algorithm != "sha256" {
        return Err(format!(
            "unsupported block_hash_algorithm '{}'",
            att.block_hash_algorithm
        ));
    }
    if !is_hex64(&att.ledger_head.hash) {
        return Err("attestation.ledger_head.hash is not a 64-char lowercase hex digest".into());
    }
    if let Some(g) = &att.genesis_hash {
        if !is_hex64(g) {
            return Err("attestation.genesis_hash is not a 64-char lowercase hex digest".into());
        }
    }

    for (i, unit) in env.memories.iter().enumerate() {
        let ctx = |msg: String| format!("memories[{i}]: {msg}");
        if !is_hex64(&unit.address) {
            return Err(ctx(format!(
                "address '{}' is not a 64-char lowercase hex digest",
                unit.address
            )));
        }
        if !VALID_TIERS.contains(&unit.tier.as_str()) {
            return Err(ctx(format!("invalid tier '{}'", unit.tier)));
        }
        if !VALID_STATES.contains(&unit.state.as_str()) {
            return Err(ctx(format!("invalid state '{}'", unit.state)));
        }
        let sigma = unit.saturation.sigma;
        if !sigma.is_finite() || !(0.0..=1.0).contains(&sigma) {
            return Err(ctx(format!("saturation.sigma {sigma} out of range [0, 1]")));
        }
        if unit.saturation.score_kind != SCORE_KIND {
            return Err(ctx(format!(
                "invalid saturation.score_kind '{}'",
                unit.saturation.score_kind
            )));
        }
        if !VALID_TRUST_LEVELS.contains(&unit.trust.level.as_str()) {
            return Err(ctx(format!("invalid trust.level '{}'", unit.trust.level)));
        }
        parse_rfc3339_ms(&unit.created_at).map_err(&ctx)?;
        parse_rfc3339_ms(&unit.provenance.timestamp).map_err(&ctx)?;
        if let Some(content) = &unit.content {
            // Identity contract: recompute BLAKE3 and compare.
            let recomputed = UorAddress::from_content(content);
            if recomputed.0 != unit.address {
                return Err(ctx(format!(
                    "identity verification failed: BLAKE3(content) = {} but address = {}",
                    recomputed.0, unit.address
                )));
            }
        }
        for edge in unit.edges.iter().flatten() {
            if !is_hex64(&edge.target) {
                return Err(ctx(format!(
                    "edge target '{}' is not a 64-char lowercase hex digest",
                    edge.target
                )));
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Import: proposal conversion
// ---------------------------------------------------------------------------

/// Local trust re-derivation for imported units (authority does not
/// transit). Content-verified units keep at most a one-notch-downgraded
/// version of the exporter's claim; unverifiable references are Unverified.
pub fn map_import_trust(exporter_level: &str, content_verified: bool) -> TrustLevel {
    if !content_verified {
        return TrustLevel::Unverified;
    }
    match exporter_level {
        "verified" => TrustLevel::UserReviewed,
        _ => TrustLevel::Unverified,
    }
}

/// Convert a validated exchange unit into a local L2 proposal unit.
///
/// Regardless of the exported tier, the proposal enters L2: crystallization
/// into L3 must go through the local zero-trust approval flow. Saturation
/// and access counters are re-derived locally; the exporter's values remain
/// visible only in the envelope, not as local authority.
pub fn to_proposal_unit(unit: &ExchangeUnit, embedding: Vec<f32>, now_ms: i64) -> MemoryUnit {
    let created_at = parse_rfc3339_ms(&unit.created_at).unwrap_or(now_ms);
    let content_verified = unit.content.is_some();
    let trust = map_import_trust(&unit.trust.level, content_verified);
    let mut tags = unit.tags.clone().unwrap_or_default();
    if !tags.iter().any(|t| t == "imported") {
        tags.push("imported".to_string());
    }
    tags.sort();
    tags.dedup();
    MemoryUnit {
        address: UorAddress(unit.address.clone()),
        embedding,
        created_at,
        last_accessed: now_ms,
        access_count: 0,
        saturation: trust.initial_saturation(),
        metadata: UnitMetadata {
            tags,
            source: Some(format!("imported:{}", unit.provenance.origin)),
            tier: Tier::L2,
            mts_score: clamp01(unit.mts_score.unwrap_or(0.0)),
        },
    }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

pub fn rfc3339(ms: i64) -> String {
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(ms)
        .unwrap_or(chrono::DateTime::UNIX_EPOCH)
        .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn parse_rfc3339_ms(s: &str) -> Result<i64, String> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.timestamp_millis())
        .map_err(|e| format!("invalid RFC 3339 timestamp '{s}': {e}"))
}

/// Manual `major.minor.patch` parse (all-numeric, exactly three components).
fn parse_semver(version: &str) -> Option<(u64, u64, u64)> {
    let mut parts = version.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some((major, minor, patch))
}

pub fn is_hex64(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn clamp01(v: f32) -> f32 {
    if v.is_finite() {
        v.clamp(0.0, 1.0)
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use evolve_core::memory::types::MemoryUnit;

    fn dummy_unit(saturation: f32, last_accessed: i64) -> MemoryUnit {
        MemoryUnit {
            address: UorAddress::from_content("dummy"),
            embedding: vec![0.1; 4],
            created_at: 0,
            last_accessed,
            access_count: 0,
            saturation,
            metadata: UnitMetadata::default(),
        }
    }

    #[test]
    fn hex64_accepts_blake3_addresses_only() {
        assert!(is_hex64(&UorAddress::from_content("x").0));
        assert!(!is_hex64("abc"));
        assert!(!is_hex64(&"A".repeat(64)));
        assert!(!is_hex64(&"g".repeat(64)));
        assert!(is_hex64(&"0".repeat(64)));
    }

    #[test]
    fn l2_state_mapping_follows_interop_table() {
        let now = 1_000_000;
        // Saturated → candidate, regardless of edges.
        assert_eq!(
            classify_l2_state(&dummy_unit(0.96, now), true, 3_600_000, 0.05, now),
            "candidate"
        );
        // Fresh with edges → linked; without → observed.
        assert_eq!(
            classify_l2_state(&dummy_unit(0.1, now), true, 3_600_000, 0.05, now),
            "linked"
        );
        assert_eq!(
            classify_l2_state(&dummy_unit(0.1, now), false, 3_600_000, 0.05, now),
            "observed"
        );
        // Long-decayed (many half-lives ago, σ=0) → stale.
        let old = dummy_unit(0.0, 0);
        let much_later = 3_600_000 * 24;
        assert_eq!(
            classify_l2_state(&old, true, 3_600_000, 0.05, much_later),
            "stale"
        );
    }

    #[test]
    fn import_trust_never_upgrades() {
        assert_eq!(map_import_trust("verified", true), TrustLevel::UserReviewed);
        assert_eq!(map_import_trust("verified", false), TrustLevel::Unverified);
        assert_eq!(
            map_import_trust("user_reviewed", true),
            TrustLevel::Unverified
        );
        assert_eq!(map_import_trust("unverified", true), TrustLevel::Unverified);
    }

    #[test]
    fn proposal_units_enter_l2_with_local_rederivation() {
        let exchange_unit = ExchangeUnit {
            address: UorAddress::from_content("hello").0,
            content: Some("hello".to_string()),
            content_type: None,
            tier: "L3".to_string(),
            state: "crystallized".to_string(),
            saturation: Saturation {
                sigma: 0.99,
                score_kind: SCORE_KIND.to_string(),
                calibrated: false,
                crystallization_threshold: None,
            },
            decay: None,
            trust: TrustBlock {
                level: "verified".to_string(),
                initial_saturation: None,
            },
            provenance: Provenance {
                origin: "unit-test".to_string(),
                observer: "test".to_string(),
                method: "cli_add".to_string(),
                timestamp: "2026-08-01T09:12:44Z".to_string(),
                source_refs: None,
            },
            created_at: "2026-08-01T09:12:44Z".to_string(),
            last_accessed_at: None,
            access_count: Some(14),
            tags: Some(vec!["imported".to_string(), "x".to_string()]),
            mts_score: Some(0.9),
            edges: None,
            ledger_ref: None,
        };
        let unit = to_proposal_unit(&exchange_unit, vec![0.0; 4], 42);
        // Exported L3/crystallized/σ=0.99 must NOT transit as authority.
        assert_eq!(unit.metadata.tier, Tier::L2);
        assert!(unit.saturation < CRYSTALLIZATION_THRESHOLD);
        assert_eq!(
            unit.saturation,
            TrustLevel::UserReviewed.initial_saturation()
        );
        assert_eq!(unit.access_count, 0);
        assert_eq!(unit.last_accessed, 42);
        assert!(
            unit.metadata
                .tags
                .iter()
                .filter(|t| *t == "imported")
                .count()
                == 1
        );
    }

    #[test]
    fn validation_rejects_wrong_major_and_bad_identity() {
        let addr = UorAddress::from_content("real content").0;
        let envelope_json = |version: &str, content: &str| {
            format!(
                r#"{{
                  "schema_version": "{version}",
                  "exporter": {{"implementation": "t", "version": "0", "exported_at": "2026-08-11T00:00:00Z"}},
                  "attestation": {{
                    "ledger_head": {{"index": 0, "hash": "{h}"}},
                    "content_address_algorithm": "blake3",
                    "block_hash_algorithm": "sha256"
                  }},
                  "memories": [{{
                    "address": "{addr}",
                    "content": "{content}",
                    "tier": "L2",
                    "state": "observed",
                    "saturation": {{"sigma": 0.5, "score_kind": "lifecycle_routing_score", "calibrated": false}},
                    "trust": {{"level": "unverified"}},
                    "provenance": {{"origin": "t", "observer": "t", "method": "cli_add", "timestamp": "2026-08-11T00:00:00Z"}},
                    "created_at": "2026-08-11T00:00:00Z"
                  }}]
                }}"#,
                h = "0".repeat(64),
            )
        };
        assert!(parse_and_validate(&envelope_json("1.0.0", "real content")).is_ok());
        let err = parse_and_validate(&envelope_json("2.0.0", "real content")).unwrap_err();
        assert!(err.contains("unsupported schema_version"), "{err}");
        let err = parse_and_validate(&envelope_json("1.0.0", "tampered")).unwrap_err();
        assert!(err.contains("identity verification failed"), "{err}");
    }

    #[test]
    fn validation_rejects_missing_attestation_cleanly() {
        let err = parse_and_validate(r#"{"schema_version": "1.0.0", "memories": []}"#).unwrap_err();
        assert!(err.contains("attestation"), "{err}");
    }
}
