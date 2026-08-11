# EvolveAI ↔ Agent Memory Interoperability Specification

**Status:** Draft v1.0.0 · 2026-08-11
**Doctrine source:** [MythologIQ-Labs-LLC/agent-memory](https://github.com/MythologIQ-Labs-LLC/agent-memory) (inspected read-only at the clone referenced below; all cited paths are relative to that repo unless prefixed with `crates/` or `docs/`, which refer to this repo)
**Exchange schema:** [`schemas/memory-exchange.schema.json`](../schemas/memory-exchange.schema.json) (this repo)

This document is the bidirectional interoperability contract between EvolveAI and the
Agent Memory doctrine: what doctrine EvolveAI consumes, how EvolveAI memories become
consumable by other memory/governance products, what lessons EvolveAI's implementation
contributes upstream, and the ordered path from *declared* to *evidenced* conformance.

Honesty rule, inherited from agent-memory `docs/35-interoperability-profiles.md`:
*"a claim without fixture evidence is documentation alignment (Level 0) wearing a
costume."* Every status below is stated at the level the evidence actually supports.

---

## 1. Scope and responsibility claim

### 1.1 The claim

EvolveAI claims the **memory metabolism** responsibility within the Agent Memory
architecture, exactly as recorded in the doctrine repo's implementation map
(`docs/05-repo-implementation-map.md`, "Related implementation map" table and the
"EvolveAI" section):

- **Canonical owner of:** autopoietic memory theory prototype; memory metabolism;
  the L1/L2/L3 tier model; REM synthesis; the CMHL decay engine; lifecycle
  orchestration.
- **Governed-uncertainty posture:** *"probabilistic/heuristic proposals allowed;
  lifecycle commit remains governed"* — EvolveAI's learned/heuristic signals
  (saturation, decay weight, MTS routing score) may **propose** decay, retention,
  consolidation, or promotion. They **do not self-authorize irreversible or canonical
  state changes** (`docs/05-repo-implementation-map.md`, "Governed-uncertainty
  contract" under the EvolveAI section).

Concretely in this repo, the claimed subsystems are:

| Responsibility | Implementation |
|---|---|
| Lifecycle orchestration | `crates/evolve-core/src/lifecycle/` (5-phase metabolic orchestrator: Grounding, SemanticPause, ActiveFlow, Detachment, RemSynthesis) |
| CMHL decay | `crates/evolve-core/src/memory/decay.rs` (thermodynamic decay `w = e^(−λ_eff·t)`, `λ_eff = λ_base·(1−σ)·ln2`; entropy injection) |
| Tier routing | `crates/evolve-core/src/tiers/` (L1 transient cache, L2 temporal graph, L3 UOR vault, router) |
| REM-synthesis consolidation | `lifecycle/orchestrator.rs::detach`/`complete_synthesis` (trace accumulation → synthesis) |
| Crystallization proposal/commit split | `crates/evolve-core/src/processor/trust.rs` (zero-trust crystallization: saturation proposes, `approve_crystallization` commits) |

### 1.2 What EvolveAI does NOT claim

- **Not the PAMA authority owner.** PAMA is native Agent Memory doctrine
  (`docs/04-governance-and-pama.md`, `docs/pama/README.md`,
  `docs/33-pama-decision-table.md`, `docs/adr/ADR-004-pama-controls-mutation-authority.md`),
  and per `docs/39-implementation-ownership-map.md` its *runtime implementation owner
  is still open*. EvolveAI's `CrystallizationPolicy` gate is a local approval switch,
  not a PAMA implementation: it exposes none of the required M0–M5 target classes,
  A0–A5 downstream authority ceilings, charter binding, or decision receipts.
- **Not the lifecycle committer of record in a composed system.**
  `docs/39-implementation-ownership-map.md` records the Lifecycle Engine row as
  *contested* between "EvolveAI proposer" and "COREFORGE Vault committer" candidates,
  and rules that "EvolveAI proposing transitions that Vault commits is a legitimate
  split … both committing is not." Where EvolveAI runs embedded in a larger runtime,
  it operates as **proposer**; standalone, its own commit path applies only within its
  local store.
- **Not a certification authority.** Crystallization-requires-certification is doctrine
  (`docs/adr/ADR-003-crystallization-requires-certification.md`, cited throughout
  `docs/35-interoperability-profiles.md` Profile 5). EvolveAI has no independent
  certification gate; its σ ≥ 0.95 + approval flow is a promotion gate, not a
  certificate.
- **Not an identity authority beyond content addressing.** EvolveAI uses BLAKE3
  content addresses (`UorAddress`); it does not claim UOR framework semantics
  ownership (identity substrate is mapped separately in `docs/39-implementation-ownership-map.md`).
- **No conformance claims.** Status is **declared, evidence none yet**. Per the
  doctrine repo's own inspection record (`docs/39-implementation-ownership-map.md`,
  "Inspection record", 2026-08-11, EvolveAI pinned at `7c163f0`): *"No doctrine
  backlink exists in any of the four [candidate repos]."* PR #16 (doctrine backlink in
  the README) is the first graduation step and is not yet merged.

---

## 2. Doctrine consumed (agent-memory → EvolveAI)

Status vocabulary follows `docs/39-implementation-ownership-map.md`:
**conformant** (evidence exists and matches doctrine), **partial** (mechanism exists
but incomplete against the doctrine contract), **declared-only** (code exists but is
unwired at runtime, or the obligation is acknowledged without mechanism),
**not-implemented**.

Honesty inputs: [`docs/REPO_REVIEW-2026-08-11.md`](REPO_REVIEW-2026-08-11.md) §5
(verified findings: mock-only embeddings; decay never prunes; lifecycle orchestrator
and shadow genome dead at runtime; L3 `get_mut` + linkage-only `verify_integrity`).

| Agent Memory doctrine (exact path) | EvolveAI subsystem | Status | Honest notes |
|---|---|---|---|
| `docs/00-glossary.md`, `docs/01-layer-model.md`, ADR-001 (`docs/adr/ADR-001-uor-is-identity-not-memory.md`) — identity is deterministic, never similarity | `memory/types.rs::UorAddress` (BLAKE3 via `chain/hash.rs::content_address`) | **conformant** (identity minting) / **partial** (survival) | Identical content → identical address, deterministic, no confidence-weighted identity. But raw content is not retained in `MemoryUnit`, so addresses cannot be re-verified after encoding, and provenance does not survive into the stored unit. |
| `docs/02-lifecycle-state-machine.md` — 13-state machine; *transition proposal vs transition commit*; promotion gates; hysteresis | `processor/trust.rs` (crystallization), `tiers/router.rs`, `lifecycle/` | **partial** | The proposal/commit split exists for exactly one transition: L2→L3 crystallization under `CrystallizationPolicy::RequireApproval` (saturation nominates; `approve_crystallization` commits). No other doctrine state is explicitly modeled; tiers are an implicit 3-state subset. **Violation to fix:** `ProcessorConfig::default()` sets `CrystallizationPolicy::Auto`, under which σ ≥ 0.95 self-promotes — an estimator authorizing its own proposal, prohibited by `02` rule 2 and ADR-020 Rule 1. Required transition metadata (actor, policy_version, estimator_version…) is not recorded. No hysteresis/threshold-stability mechanism. |
| `docs/02-lifecycle-state-machine.md` — 5-phase session lifecycle analog | `lifecycle/orchestrator.rs` (Idle→Grounding→SemanticPause→ActiveFlow→Detachment→RemSynthesis) | **declared-only** | Implemented and tested, but no CLI or Tauri path ever calls `begin_operation`/`detach`; phases never advance at runtime and REM synthesis never runs (`REPO_REVIEW-2026-08-11.md` §5.5). |
| `docs/03-scoring-and-decay.md` — saturation is a lifecycle routing score, not truth; score metadata (estimator id/version, calibration scope) | `memory/decay.rs`, `MemoryUnit.saturation`, `processor/slo.rs` (pressure) | **partial** | σ ∈ [0,1] is used exactly as doctrine intends — routing pressure, never truth. Pressure-aware decay implements the `temporal_pressure` signal. But no score metadata exists: no estimator identity/version, no calibration reference, `mts_score` partially ceremonial (`accuracy` constant 0.5, `REPO_REVIEW-2026-08-11.md` §5.6). |
| `docs/09-calibration-protocol.md`, `schemas/calibration-results.schema.json` | — | **not-implemented** | No calibration run has ever been performed; σ thresholds (0.95 crystallization) are uncalibrated constants. |
| `docs/21-forgetting-consolidation-and-memory-metabolism.md` — forgetting as first-class; decay/pruning/archival/tombstoning are distinct ops | `memory/decay.rs::should_prune`, query-time decay filtering | **partial** | Passive decay + interference (entropy injection on conflict) are real. But **decay never deletes**: `should_prune` filters at query time only; L2/L3 grow unboundedly; no tick/GC/consolidation loop exists in the Rust code (`REPO_REVIEW-2026-08-11.md` §5.4). Forgetting is currently *suppression only*, which doctrine treats as one mechanism among twelve. |
| `docs/28-retention-deletion-and-tombstones.md`, ADR-015 | CLI `forget` (v5.8) | **not-implemented** (tombstones) | Deletion removes the unit; no tombstone, no deletion receipt, no derived-state repair. Fails the doctrine rule that "pruned memory disappears without retention policy" is a conformance failure (`docs/06-conformance-test-plan.md`, "Failure modes"). |
| `docs/04-governance-and-pama.md`, `schemas/pama-decision.schema.json`, `docs/33-pama-decision-table.md` | `processor/trust.rs::CrystallizationPolicy` | **declared-only** | The RequireApproval gate is the embryo of a PAMA seam (a human approval between proposal and commit), but none of the required contract surface exists: no M0–M5/A0–A5 classification, no policy version, no permitted/prohibited action sets, no decision receipts (`schemas/decision-receipt.schema.json`). |
| `docs/adr/ADR-020-probabilistic-discovery-deterministic-governance.md` — estimator output is not authority | zero-trust crystallization + entropy injection | **partial** | Under RequireApproval, confidence cannot self-promote (Rule 1 honored for the L2→L3 seam). Under the default-config `Auto` policy it can — see the `02` row. Uncertainty is not preserved anywhere (Rule 5 unmet). |
| `schemas/memory-unit.schema.json` — required: `id, type, state, provenance, evidence, saturation, authority, created_at` | `memory/types.rs::MemoryUnit` | **partial** | EvolveAI units carry `id` (address), `saturation`, `created_at`, and tier. They carry **no** `provenance`, `evidence`, `authority`, or explicit `state` — four of the eight required fields. A raw EvolveAI unit therefore cannot validate as a doctrine memory unit; the exchange envelope (§3) maps what exists and marks what does not. |
| `docs/30-memory-observability-and-audit-events.md`, `schemas/memory-audit-event.schema.json`, ADR-017 | `chain/` (hash-chained ledger) | **partial** | L3 appends are ledgered (SHA-256 data hash per crystallized unit, chained blocks with linkage verification). But blocks carry only `{index, timestamp, data_hash, previous_hash, hash}` — no event type, actor, policy version, or memory id; transitions other than L3 appends are not ledgered at all. |
| `docs/06-conformance-test-plan.md`, `fixtures/`, `schemas/conformance-report.schema.json`, `reference/run_conformance.py` | evolve-core test suite (~231 tests) | **declared-only** | No agent-memory fixture has ever been run against EvolveAI. Internal tests do exercise two trap-class *analogs* by design: access-spam resistance (weighted pinning: `Access` pins at 0.01 vs `CryptoVerification` 0.15, `memory/decay.rs::pin_weight`, matching Fixture C's required plateau) and contradiction pressure (`record_conflict` → `inject_entropy`, matching Fixture E's "contradiction injects entropy, saturation decreases"). Analogs are not fixture evidence. |
| `docs/16-source-trust-and-reputation.md`, ADR-009 — source trust is a first-class signal | `memory/types.rs::TrustLevel` (Unverified/UserReviewed/Verified → initial σ 0.0/0.1/0.3) | **partial** | Trust exists as a typed input signal and seeds saturation, honoring "trust travels as evidence weight, never as authority" (`docs/34-adapter-contracts.md`, evidence adapter). No reputation dynamics, no per-source records. |
| `docs/05-repo-implementation-map.md` — Shadow Genome as negative-memory substrate | `crates/evolve-core/src/shadow/` | **declared-only** | Failure-category genome and interceptor implemented and tested, but `record_failure` is never called from any frontend; `check_safety` can only return Pass at runtime (`REPO_REVIEW-2026-08-11.md` §5.5). |
| `docs/35-interoperability-profiles.md` — Profiles 1–6 | — | **no profile claimable** | Every profile claim requires passing fixtures. EvolveAI can *target* Profile 1 (identity + provenance) first; §5 sequences this. |
| `docs/34-adapter-contracts.md` — common handoff record; absence-is-absence; rejection-only failure | `schemas/memory-exchange.schema.json` (this repo) | **declared-only** | The exchange envelope in §3 is designed to satisfy the lifecycle/scoring adapter field requirements at the seam; no adapter runtime exists yet. |
| `docs/adr/ADR-021-portable-memory-governance-evidence-boundary.md` — evidence does not create memory authority | exchange envelope attestation block | **declared-only** | §3's attestation follows ADR-021 Rule 1: the chain-head attestation proves *which ledger state produced the export*, never that any mutation was semantically authorized. |

**Documents named in PR #16's framing that were verified to exist:** the lifecycle
state machine (`docs/02-lifecycle-state-machine.md`), the forgetting/consolidation/
metabolism doctrine (`docs/21-forgetting-consolidation-and-memory-metabolism.md`),
PAMA (`docs/04-governance-and-pama.md`, `docs/pama/README.md`,
`docs/33-pama-decision-table.md`), ADR-020, the conformance test plan
(`docs/06-conformance-test-plan.md`), and the memory-record/provenance schemas
(`schemas/memory-unit.schema.json`, `schemas/decision-receipt.schema.json`,
`schemas/memory-audit-event.schema.json`). **Gap:** agent-memory has **no dedicated
memory *exchange/wire* schema** — the adapter handoff record of
`docs/34-adapter-contracts.md` is prose-specified only, and ADR-021 explicitly says
of its portable evidence projection: *"The exact wire shape is not accepted doctrine
yet."* That gap is why this repo mints its own exchange schema (§3) while mirroring
agent-memory's schema conventions.

---

## 3. Memory Exchange Format (EvolveAI ↔ world)

### 3.1 Contract

The exchange format is defined normatively by
[`schemas/memory-exchange.schema.json`](../schemas/memory-exchange.schema.json)
(JSON Schema draft 2020-12), version **1.0.0**. It mirrors agent-memory's schema
conventions as established in `schemas/*.schema.json` of the doctrine repo:

- `$schema: https://json-schema.org/draft/2020-12/schema`;
- repo-path `$id` (`https://github.com/MythologIQ-Labs-LLC/EvolveAI/schemas/memory-exchange.schema.json`,
  matching the doctrine style `https://github.com/MythologIQ-Labs-LLC/agent-memory/schemas/…`);
- a semver `schema_version` field on instances;
- closed objects (`additionalProperties: false`) and shared `$defs`.

An envelope contains three blocks:

1. **`exporter`** — implementation, version, snapshot format version
   (`SNAPSHOT_VERSION`, currently `"5.0.0"` in `processor/types.rs`), doctrine
   reference, export timestamp.
2. **`attestation`** — the provenance attestation: head block of the exporting
   hash-chained ledger (`index`, `hash`, `timestamp` from `chain/block.rs`), genesis
   hash (chain lineage identity), chain length, declared algorithms
   (`content_address_algorithm: blake3` for `UorAddress`;
   `block_hash_algorithm: sha256` for blocks — the two algorithms differ in
   evolve-core and the envelope says so explicitly), and whether
   `Ledger::verify()` passed at export time. Per ADR-021 Rule 1, this attestation is
   **integrity evidence, not authority**: it proves which chain state produced the
   export; it does not prove any exported unit was authorized, certified, or even
   still matches its ledgered `data_hash` (see the L3 lesson in §4).
3. **`memories[]`** — exchange memory units.

### 3.2 Field mapping

| Envelope field | EvolveAI source | agent-memory `memory-unit.schema.json` mapping |
|---|---|---|
| `address` | `MemoryUnit.address` (`UorAddress`, BLAKE3 hex) | `id` |
| `content` | **not retained by evolve-core** (only the embedding is stored); null unless supplied from an external store | `content_ref` |
| `tier` | `UnitMetadata.tier` | no direct equivalent (routing fact; advisory) |
| `state` | derived — see §3.3 | `state` (declared subset) |
| `saturation.sigma` | `MemoryUnit.saturation` | `saturation.sigma` |
| `saturation.score_kind` | constant `lifecycle_routing_score` | `saturation.score_kind` (per `docs/03-scoring-and-decay.md`: never a probability) |
| `saturation.calibrated` | constant `false` (no calibration run exists) | `saturation.calibrated` |
| `decay.half_life_ms` / `decay.pressure` | `DecoderConfig` half-life; `processor/slo.rs` pressure | `decay_profile.lambda_base` / `decay_profile.pressure` |
| `trust.level` | `InputMetadata.trust` (`TrustLevel`) | evidence-weight input; **not** `authority` |
| `provenance` | reconstructed from `UnitMetadata.source` + encoder identity; `origin: "unknown"` where unrecorded | `provenance` (required block) |
| `created_at`, `last_accessed_at` | `MemoryUnit.created_at`/`last_accessed` (epoch ms → RFC 3339 on the wire) | `created_at`, `decay_profile.last_accessed_at` |
| `access_count`, `tags`, `mts_score` | `MemoryUnit.access_count`, `UnitMetadata` | `signals[]` candidates |
| `edges[]` | `L2Graph` outgoing `Edge { target, weight, created_at }` | Linked-state graph relations (`docs/02`, "Linked") |
| `ledger_ref` (L3 only) | block index/hash + `data_hash` recorded at crystallization | `ledger_ref` |

### 3.3 Tier → lifecycle-state mapping (declared subset)

Per `docs/35-interoperability-profiles.md` Profile 2, an implementation may exchange
"a declared, mapped subset" of the 13-state machine. EvolveAI's declared subset:

| EvolveAI condition | Exported `state` |
|---|---|
| L1 unit | `transient` |
| L2 unit, no edges | `observed` |
| L2 unit with edges | `linked` |
| L2 unit, σ boosted by Corroboration/CrossReference events | `reinforced` |
| L2 unit, σ ≥ 0.95, awaiting `approve_crystallization` | `candidate` |
| L3 unit | `crystallized` |
| decayed weight below prune threshold (query-suppressed) | `stale` |
| removed via `forget` | `pruned` (not exportable — no tombstone survives) |

**Honest limitations:** EvolveAI cannot emit `disputed`, `corrected`, or `reconciled`
— conflicts exist only as entropy injected into σ (`processor/trust.rs::record_conflict`),
with no persistent dispute state. It cannot emit `pending_verification` or a
certification block, because no certification gate exists. Exported `crystallized`
therefore means "crystallized under EvolveAI's promotion gate," **not** "certified"
in the ADR-003 sense; importers at Profile 5 must treat it as at most `candidate`.

### 3.4 Import rules (world → EvolveAI, and EvolveAI exports → other systems)

Aligned with `docs/34-adapter-contracts.md` (absence-is-absence; rejection-only
failure) and `docs/35-interoperability-profiles.md` ("Authority conflict between
systems"):

1. **Verify identity where possible.** If `content` is present, recompute BLAKE3 and
   reject the unit on mismatch. If absent, the address is a reference, not verified
   identity — record that distinction.
2. **Authority does not transit.** Exported `tier`, `state`, `trust`, and σ are
   evidence about the *exporter's* view. The importer re-routes, re-scores, and
   re-derives trust under its own policy; nothing in an envelope authorizes local
   promotion, and imported units enter as acquisition mode `imported`
   (`memory-unit.schema.json` `acquisition_mode`).
3. **No state upgrades on import.** An imported unit's local state may map equal-or-
   downward (e.g. `crystallized` → `candidate`), never upward.
4. **Reject whole, not partially.** An envelope failing schema validation, or a unit
   failing identity verification, is rejected with a machine-readable reason —
   never repaired or defaulted.
5. **Unknown versions are not processed for consequence.** A `schema_version` the
   importer does not know must not feed consequential mutation
   (`docs/34-adapter-contracts.md`, versioning rule; mirrors evolve-core's own
   strict `SNAPSHOT_VERSION` check in `processor/persist.rs`).

### 3.5 Worked example

A two-unit export (one crystallized L3 unit, one linked L2 unit), valid against
`schemas/memory-exchange.schema.json` v1.0.0:

```json
{
  "schema_version": "1.0.0",
  "exporter": {
    "implementation": "evolve-core",
    "version": "6.1.0",
    "snapshot_version": "5.0.0",
    "doctrine_ref": "MythologIQ-Labs-LLC/agent-memory",
    "exported_at": "2026-08-11T18:30:00Z"
  },
  "attestation": {
    "ledger_head": {
      "index": 42,
      "hash": "c9a1f0b2d4e6a8c0e2f4a6b8d0c2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8",
      "timestamp": 1754937000000
    },
    "genesis_hash": "ece694ee280ee892649d195e6393e979cad072b076afa973816e925f01eb28b4",
    "chain_length": 43,
    "content_address_algorithm": "blake3",
    "block_hash_algorithm": "sha256",
    "chain_verified_at_export": true
  },
  "memories": [
    {
      "address": "8f3b2c1d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9",
      "content": null,
      "content_type": "text",
      "tier": "L3",
      "state": "crystallized",
      "saturation": {
        "sigma": 0.97,
        "score_kind": "lifecycle_routing_score",
        "calibrated": false,
        "crystallization_threshold": 0.95
      },
      "decay": {
        "model": "cmhl_thermodynamic",
        "half_life_ms": 604800000,
        "pressure": 0.12,
        "decayed_weight_at_export": 0.999
      },
      "trust": { "level": "verified", "initial_saturation": 0.3 },
      "provenance": {
        "origin": "docs/ARCHITECTURE_PLAN.md",
        "observer": "evolve-core/encoder",
        "method": "file_ingest",
        "timestamp": "2026-08-01T09:12:44Z"
      },
      "created_at": "2026-08-01T09:12:44Z",
      "last_accessed_at": "2026-08-10T17:03:12Z",
      "access_count": 14,
      "tags": ["architecture", "sensitive"],
      "mts_score": 0.82,
      "edges": [],
      "ledger_ref": {
        "block_index": 42,
        "block_hash": "c9a1f0b2d4e6a8c0e2f4a6b8d0c2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8",
        "data_hash": "5d41402abc4b2a76b9719d911017c592e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4"
      }
    },
    {
      "address": "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809",
      "content": "Pressure-aware decay shortens half-life under capacity pressure.",
      "content_type": "text",
      "tier": "L2",
      "state": "linked",
      "saturation": {
        "sigma": 0.41,
        "score_kind": "lifecycle_routing_score",
        "calibrated": false
      },
      "decay": {
        "model": "cmhl_thermodynamic",
        "half_life_ms": 604800000,
        "pressure": 0.12,
        "decayed_weight_at_export": 0.63
      },
      "trust": { "level": "user_reviewed", "initial_saturation": 0.1 },
      "provenance": {
        "origin": "unknown",
        "observer": "evolve-core/encoder",
        "method": "cli_add",
        "timestamp": "2026-08-09T11:20:00Z"
      },
      "created_at": "2026-08-09T11:20:00Z",
      "last_accessed_at": "2026-08-09T11:20:00Z",
      "access_count": 2,
      "tags": [],
      "mts_score": 0.44,
      "edges": [
        {
          "target": "8f3b2c1d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9",
          "weight": 0.7,
          "created_at": "2026-08-09T11:20:01Z"
        }
      ]
    }
  ]
}
```

Note the first unit: `content` is null (evolve-core stores only the embedding), so an
importer can hold its address as a reference but cannot independently re-verify it —
and the schema forces that honesty rather than letting an unverifiable address
masquerade as verified identity.

---

## 4. Lessons contributed (EvolveAI → agent-memory)

Each item is framed as a candidate issue/ADR for the agent-memory repo, with the
doctrine document it would extend.

**4.1 — Thermodynamic decay with entropy injection is a reversible-forgetting
mechanism.** (Candidate extension to `docs/21-forgetting-consolidation-and-memory-metabolism.md`
and `docs/03-scoring-and-decay.md`.) EvolveAI couples decay rate to saturation
through a temperature term — `T_ctx = (1−σ)·ln2`, `λ_eff = λ_base·T_ctx`
(`memory/decay.rs`) — so contradiction does not delete a memory: `inject_entropy`
lowers σ, which *raises* temperature and accelerates decay, while any subsequent
corroboration re-pins σ and slows it again. This is a concrete, continuous
implementation of doctrine's "contradiction should increase review and routing
pressure, not automatically trigger deletion" (`docs/21`, "Forgetting and
contradiction") in which demotion is smoothly reversible until a governed prune
commits. The doctrine currently describes decay and interference as separate
mechanisms in its forgetting table; the lesson is that a single thermodynamic
parameter can implement passive decay, interference, and rehabilitation as one
auditable state variable.

**4.2 — Zero-trust crystallization is governed uncertainty in practice — and config
defaults are an authority surface.** (Candidate case study for ADR-020 and
`docs/02-lifecycle-state-machine.md`.) EvolveAI's `CrystallizationPolicy` enum
implements the proposal/commit split for exactly one consequential transition:
saturation ≥ 0.95 makes a unit a *candidate*; only an explicit
`approve_crystallization` call commits L2→L3 (`processor/trust.rs`). This is
ADR-020 Rule 1 rendered in ~30 lines. The negative half of the lesson is equally
doctrine-relevant: the enum's own default is `RequireApproval`, but
`ProcessorConfig::default()` overrides it to `Auto`, under which the estimator's
score self-authorizes promotion. Two defaults, one authority posture flipped —
silently. Candidate doctrine addition: *the effective authority posture must be a
single, ledgered configuration fact; a permissive posture reachable through a
composition of defaults is a governed-uncertainty violation even when the strict
posture exists in code.*

**4.3 — Ledger-backed tier transitions: appends are necessary but not sufficient
audit events.** (Candidate input to `docs/30-memory-observability-and-audit-events.md`
/ `schemas/memory-audit-event.schema.json`.) Every EvolveAI crystallization appends
a SHA-256 hash of the serialized unit to a hash chain (`tiers/l3_vault.rs::store`,
`chain/ledger.rs`), giving cheap tamper-evidence for *when something entered L3* and
*in what order*. Implementation experience shows what the minimal block —
`{index, timestamp, data_hash, previous_hash, hash}` — cannot answer: who authorized
the transition, under which policy, from which prior state. The doctrine's audit-event
schema already requires `event_type`, `actor`, `component`, `policy_version`; the
lesson is a lower bound from the other direction: a chained data-hash alone still
delivers ordering and tamper-evidence, so the doctrine could define a *degraded but
valid* minimal audit tier for constrained implementations, with an explicit statement
of which conformance assertions it cannot support.

**4.4 — Pressure-aware decay connects memory economics to the decay engine.**
(Candidate extension to `docs/37-memory-economics-and-budget-policy.md` and
`docs/03-scoring-and-decay.md`.) EvolveAI computes a capacity-pressure scalar from
tier utilization and divides the effective half-life by `1 + pressure^curve`
(`processor/slo.rs::calculate_pressure`, `pressure_adjusted_half_life`): when stores
fill, everything forgets faster, proportionally, without any per-unit decision. This
implements doctrine's "temporal_pressure" signal and its budget-policy concerns as a
single mechanism, and it stayed within governed-uncertainty bounds by construction —
pressure accelerates *decay* (a demotion pressure) but never touches the promotion
gate. Candidate doctrine text: budget pressure may modulate decay rates globally, but
must not lower promotion/certification thresholds, or scarcity becomes an authority
bypass.

**4.5 — The L3 mutability lesson: immutability claims require content
re-verification; linkage checks are insufficient.** (Candidate conformance fixture
for `docs/06-conformance-test-plan.md` and hardening note for
`docs/31-recovery-rollback-and-replay.md`.) EvolveAI's `verify_integrity()` verifies
block linkage and block-hash recomputation only (`chain/ledger.rs::verify`), while
`L3Vault::get_mut` allows in-place mutation of stored "immutable" units — trust
updates and entropy injection mutate crystallized entries after their `data_hash` was
ledgered (`tiers/l3_vault.rs`, `processor/trust.rs::record_access`/`record_conflict`;
documented in `docs/REPO_REVIEW-2026-08-11.md` §5.3). Result: vault contents can
silently diverge from the ledger while verification reports success. Proposed
upstream artifact: a **"ledger-blind mutation" fixture** — chain valid, entry
mutated — that a conforming implementation must fail loudly, by re-hashing stored
entries against their ledgered `data_hash` during verification. No current
agent-memory fixture covers this case; the closest, `fixtures/unauthorized-mutation-attempt.json`,
tests the authority gate, not detection of a mutation that bypassed it. (Hardening
is in flight on this branch as of 2026-08-11: a `verify_full` pass that re-hashes
stored entries against their most recent ledger entry, plus ledgered `update`
entries for legitimate trust mutations — precisely the fix this lesson prescribes.
The lesson stands as implementation history worth encoding upstream as a fixture.)

**4.6 — Weighted pinning events are a by-construction access-spam defense.**
(Candidate implementation note for `docs/02-lifecycle-state-machine.md` "Access-spam
junk" and `docs/21` "Retrieval-induced reinforcement must be controlled".) EvolveAI
weights saturation boosts by event *kind* — `Access` 0.01, `CrossReference` 0.05,
`Corroboration` 0.05, `CryptoVerification` 0.15 — applied through a saturating
exponential `σ' = 1−(1−σ)·e^(−w)` (`memory/decay.rs::pin_weight`,
`boost_saturation_weighted`). Raw access alone asymptotically plateaus far below the
0.95 crystallization threshold, while corroboration and cryptographic verification
dominate — exactly the doctrine requirement "access alone has low pinning weight;
cross-reference and corroboration matter more than raw reads," plus doctrine's
"diminishing returns for repeated access" control, achieved without counters or caps.
The exponential-saturation form is a reusable primitive worth naming upstream.

**4.7 — Trust-seeded saturation keeps source trust as an initial condition, not a
multiplier.** (Minor candidate note for `docs/16-source-trust-and-reputation.md`.)
`TrustLevel::initial_saturation` (0.0 / 0.1 / 0.3) seeds σ at encoding time and then
stops mattering — subsequent lifecycle behavior depends only on evidence events. This
cleanly separates "where it came from" (a one-time head start) from "what happened
since" (pinning history), avoiding the failure mode where a trusted source's memories
permanently outrank corroborated ones.

---

## 5. Conformance roadmap: from `declared` to evidenced

Target artifacts are the doctrine repo's conformance surface: the test plan
(`docs/06-conformance-test-plan.md`), the fixture corpus (`fixtures/*.json`), the
reference harness (`reference/run_conformance.py`, `reference/agentmem_ref/`), the
report schema (`schemas/conformance-report.schema.json`), and the profile ladder
(`docs/35-interoperability-profiles.md`). Graduation mechanics follow
`docs/39-implementation-ownership-map.md` ("Resolution path") and
`docs/05-repo-implementation-map.md` ("Required cross-repo backlinks"): backlink →
implementation-alignment issue → fixture results claiming a profile.

Ordered steps (each unblocks the next; conformance levels refer to the table in
`docs/06-conformance-test-plan.md`):

1. **Merge the doctrine backlink (PR #16).** Establishes Level 0 (documentation
   alignment) and satisfies the first graduation evidence item. Zero code risk;
   already recommended first in `docs/REPO_REVIEW-2026-08-11.md` §4.
2. **File the implementation-alignment issue upstream** using the doctrine repo's
   template (`.github/ISSUE_TEMPLATE/implementation-conformance.yml`), mapping
   EvolveAI's slice exactly as §1 of this document states it — proposer of metabolism
   transitions, not PAMA owner, not certifier.
3. **Land the L3 integrity hardening** (repo review Phase 1 item 9; in progress on
   this branch): remove or gate `L3Vault::get_mut`, re-verify stored entries against
   their ledgered hashes (content re-verification, not linkage-only), and model
   post-crystallization trust/σ updates as new chain entries. Until this lands, the
   envelope's `chain_verified_at_export` is honest but weak (linkage-only), and no
   identity/provenance claim can be evidenced. Also fix the authority-posture default
   from lesson 4.2 (`ProcessorConfig::default()` must not select `Auto`).
4. **Retain provenance and content addressability**: record `origin/observer/method/
   timestamp` on ingestion and either retain content or an external content ref, so
   units satisfy the four missing required fields of `memory-unit.schema.json` and
   exports can carry verifiable addresses. → Level 1, and the implementation half of
   **Profile 1** (identity and provenance).
5. **Implement the exchange envelope exporter/importer** against
   [`schemas/memory-exchange.schema.json`](../schemas/memory-exchange.schema.json),
   with the §3.4 import rules, validated in CI (which must exist first —
   `docs/REPO_REVIEW-2026-08-11.md` Phase 0 item 1).
6. **Wire the metabolism loop**: drive lifecycle phases from encode/query, add a
   decay tick that actually prunes/consolidates, and leave a tombstone + ledger
   record per prune (doctrine `docs/28-retention-deletion-and-tombstones.md`).
   → Level 2, and the evidence base for **Profile 2** fixtures
   (`fixtures/ephemeral-memory.json`, `fixtures/pruning-with-audit-preservation.json`).
7. **Run the trap-class fixtures** via an adapter to the reference harness
   (`reference/run_conformance.py`): `fixtures/access-spam-junk.json`,
   `fixtures/confidently-wrong-memory.json`, `fixtures/threshold-jitter.json`,
   `fixtures/estimator-disagreement.json`, `fixtures/out-of-calibration-scope.json`.
   Threshold-jitter will require adding hysteresis (enter/exit thresholds per
   `docs/02-lifecycle-state-machine.md`, "Threshold stability and hysteresis") —
   EvolveAI currently has a single 0.95 threshold.
8. **Calibrate σ** per `docs/09-calibration-protocol.md`, publishing a
   `schemas/calibration-results.schema.json` instance and generated report
   (`scripts/generate_calibration_report.py` upstream). Note honestly that σ is a
   routing score (`sigma_is_probabilistic: false`). → Level 3 / **Profile 3**.
9. **Grow the approval gate into a PAMA-shaped seam**: classify crystallization,
   pruning, and (future) deletion as M-class operations, emit
   `schemas/pama-decision.schema.json` and `schemas/decision-receipt.schema.json`
   instances, bind decisions to a policy version. → Level 4 / **Profile 4**.
10. **Add an independent certification gate before L3** (ADR-003), separate from the
    saturation estimator, with revocation/demotion paths. → Level 5 / **Profile 5**.
11. **Publish a conformance report** (`schemas/conformance-report.schema.json`) with
    fixtures run/passed/failed, claimed profiles, scopes, and known exemptions —
    replacing "status declared, evidence none yet" with a checkable artifact.

Steps 1–2 are paperwork. Step 3 is the highest-value engineering item: it converts
EvolveAI's central marketing claim ("cryptographic memory integrity", risk grade L3)
into something the attestation block of every exported envelope can actually stand
behind.

---

*Files this specification is derived from are cited inline. Doctrine repo inspected
read-only; nothing in this document modifies agent-memory. This document and
`schemas/memory-exchange.schema.json` are the only files added; no existing file was
touched.*
