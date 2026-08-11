# Plan: v6.3 Interop Conformance Evidence

Moves the agent-memory relationship from `declared` to evidenced.
Doctrine base: docs/INTEROP.md (§2 conformance table, §4 lessons, §5
roadmap) and the agent-memory repo's `docs/06-conformance-test-plan.md`,
`schemas/conformance-report.schema.json`, `reference/run_conformance.py`.

## Open Questions

1. **Where evidence lives**: agent-memory's convention keeps
   `reports/` in-repo. Plan adopts `reports/conformance/` here with
   dated, schema-conformant JSON. Confirm agent-memory maintainers want
   a copy upstream (their `docs/39` ownership map records inspections).
2. **Upstream filing access**: Phase 3 files issues/PRs against
   MythologIQ-Labs-LLC/agent-memory — requires that repo enabled for
   the session/actor doing the filing.
3. **PR #16 must merge first** (README doctrine backlink) — the
   ownership map upstream currently records "no doctrine backlink
   exists"; evidence should not land before the claim does.

## Phase 1: Conformance harness

### Affected Files

- `crates/evolve-core/tests/conformance.rs` — **NEW**: doctrine-keyed tests
- `scripts/conformance.sh` — **NEW**: runs the suite, emits the report
- `schemas/` — vendored copy of agent-memory's conformance-report schema
  (pinned by commit hash in a comment)

### Changes

`tests/conformance.rs` encodes agent-memory's test plan levels as
executable assertions against evolve-core, one module per doctrine area,
each test annotated with the doctrine doc/section it evidences:
lifecycle state machine (phase progression, budget exhaustion, no
self-authorized irreversible transitions — RequireApproval default),
forgetting/metabolism (decay tick prunes, pins respected, L3 explicit-
only forgetting, entropy-injection reversibility), provenance (ledger
entry per L3 mutation, tamper detection via verify_full), exchange
(envelope export validates against schemas/memory-exchange.schema.json;
import honors the proposals-only boundary — depends on the v6.1 CLI
export/import pass). `scripts/conformance.sh` runs `cargo test
conformance -- --format json`, maps results into a
conformance-report.schema.json instance (jq), writes
`reports/conformance/<date>-evolveai.json`.

### Unit Tests

- The harness IS the tests; additionally one meta-test validates the
  generated report parses and carries required fields per the vendored
  schema.

## Phase 2: Evidence publication

### Affected Files

- `reports/conformance/2026-XX-XX-evolveai.json` — **NEW**: first report
- `docs/INTEROP.md` — §2 table rows updated with evidence links; §5
  roadmap items checked off
- `README.md` — doctrine backlink section (post-PR-#16 merge) gains the
  conformance-report link and drops "none yet"

### Changes

Generate the report from the Phase 1 harness on CI (artifact) and commit
the canonical run. Every INTEROP §2 row that moved states cites the test
name(s) evidencing it. Statuses stay honest: rows the harness cannot yet
evidence (e.g. PAMA — no runtime exists anywhere) remain declared-only.

### Unit Tests

- CI job asserts the committed report is regenerable (run harness,
  compare modulo timestamp fields) so evidence can't silently rot.

## Phase 3: Upstream contributions (agent-memory repo)

### Affected Files (upstream)

- Issues: the seven lessons from INTEROP §4 (one issue each, referencing
  the EvolveAI commits that embody them), the ledger-blind-mutation
  fixture proposal, and `docs/Research/UOR-GITHUB-ISSUE-DRAFT.md` filed
  to its target repo
- PR: memory-exchange wire schema proposed as the ADR-021 wire shape
  (agent-memory has no exchange schema; ours is written in their
  conventions for exactly this purpose)

### Changes

Each filing links back to the EvolveAI evidence (report + tests). The
wire-schema PR offers `schemas/memory-exchange.schema.json` with
provenance attestation as a starting point, framed as proposal not fait
accompli — their maintainers own acceptance.

## CI validation

`cargo test -p evolve-core --test conformance`, `scripts/conformance.sh`
(exit 0 + valid report), plus the standing gates from ci.yml.
