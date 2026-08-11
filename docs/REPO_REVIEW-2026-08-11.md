# EvolveAI Repository Review — 2026-08-11

Comprehensive product-readiness review covering the Rust workspace, the legacy
TypeScript core, the UI/Tauri layer, documentation and governance, dependency
currency, and GitHub process state (issues, PRs, CI). Findings are ordered by
severity within each section; the final section is a proposed phased roadmap.

---

## 1. Executive summary

EvolveAI's **research core is in good shape**: `crates/evolve-core` is a clean,
well-factored, ~231-test in-memory implementation of the thermodynamic memory
model (decay, trust scoring, zero-trust crystallization, hash-chained ledger),
and the governance ledger was maintained rigorously through the v6.1.0 seal.

The **product shell around that core is not shippable today**:

- The desktop app (Tauri) cannot be launched or built as configured — the
  frontend dependencies (`react`, `react-dom`, `@tauri-apps/api`, `vite`) are
  absent from `package.json`, and `tauri.conf.json` invokes `dev:frontend` /
  `build:frontend` scripts that do not exist.
- `npm run build` / `npm run typecheck` fail with **304 tsc errors**;
  `npm run lint` fails outright (ESLint 10 installed with no flat config).
- There is **no CI whatsoever** — no `.github/` directory; the only workflows
  are GitHub's auto-managed Dependabot and CodeQL. Nothing builds, lints, or
  tests any PR. Seven dependabot PRs sit open, unverifiable by any gate.
- **Version identity is scattered across five values**: v1.0.0 (CLAUDE.md),
  5.2.0 (package.json, evolve-core), v5.9.0 (SYSTEM_STATE.md), v6.1.0
  (META_LEDGER.md, evolve-cli), 0.1.0 (src-tauri). Zero git tags exist.
- The README still describes the pre-rewrite TypeScript prototype and never
  mentions the Rust core, the CLI, or the Tauri app — the actual v3→v6.1
  deliverables.

**Verdict:** the science is ahead of the software. The next phase of work is
product engineering — CI, packaging, wiring the dormant subsystems, real
embeddings, durable persistence — not more memory theory.

---

## 2. Repository state

### 2.1 Two codebases, one repo

| Side | Location | State |
|---|---|---|
| TypeScript prototype (v1.0–v2.1) | `src/`, `lib/`, `components/` | **Frozen** since 2026-03-18. 164 vitest tests still pass. Superseded module-for-module by the Rust rewrite. |
| Rust implementation (v3.0–v6.1) | `crates/evolve-core`, `crates/evolve-cli`, `src-tauri/` | **Active.** ~231 tests pass. This is the product. |

The TS core is not referenced by the Rust side and serves no runtime purpose.
It should be explicitly archived (moved under `_archive/` or a `legacy/` tag)
or deleted, and CLAUDE.md/README rewritten around the Rust workspace.
Additional dead code: `lib/conversational-mode.ts` imports two files that do
not exist; `components/ui/` (~45 shadcn components) has no installed
dependencies and is excluded from the TS program.

### 2.2 Version and provenance drift

- `META_LEDGER.md` is authoritative and current through **v6.1.0** (81 chained
  entries, sealed 2026-03-19). Everything else disagrees:
  - `CLAUDE.md` — "RELEASED (v1.0.0)", final hash from ledger entry ~#7 (~74 entries stale).
  - `package.json` + `crates/evolve-core` — 5.2.0 (release-bump ritual stopped after v5.2).
  - `docs/SYSTEM_STATE.md` — v5.9.0, "201 tests" (two releases stale).
  - `crates/evolve-cli` — 6.1.0. `src-tauri` — 0.1.0. Snapshot format constant — "5.0.0".
- **Zero git tags** despite ledger entries recording tags for each release.
- The committed `Cargo.lock` is stale: it lists evolve-core 5.1.0 and omits
  evolve-cli entirely; `cargo check` regenerates it.
- Four commits postdate the last ledger entry (submodule migration ×2,
  dependabot merges ×2) with no ledger entries — the chain says SEALED while
  ~5 months of history is unrecorded.
- Governance tooling (`scripts/*.ps1`) is PowerShell-only and still hashes
  only `src/**/*.ts` — it predates the Rust rewrite and cannot cover the code
  that actually changes, nor run on Linux CI without pwsh.

---

## 3. Broken gates and build health (verified in this session)

| Gate | Result |
|---|---|
| `npm run test` | ✅ 164/164 pass (vitest 1.6.1) — but covers only the frozen TS prototype |
| `npm run typecheck` / `build` | ❌ **304 errors** — 236× TS2835 (missing `.js` extensions under `nodenext`), plus TS6133/TS7006/TS1361 |
| `npm run lint` | ❌ ESLint 10.7 requires flat `eslint.config.js`; none exists, and the script still passes the removed `--ext` flag. The July eslint bump (PR #10) was merged with no config migration and no CI to catch it |
| `cargo check -p evolve-core -p evolve-cli` | ✅ clean |
| `cargo test -p evolve-core` | ✅ all pass |
| `cargo build` (src-tauri) | ⚠️ requires GTK system libraries (expected on Linux for Tauri; not a code defect — but undocumented) |
| Fresh clone without `--recurse-submodules` | ❌ **entire Rust workspace fails to build** — `gg-core` is a path dependency (`vendor/GG-CORE/core-runtime`), and Cargo must read a path dep's manifest even though the `ggcore` feature is off |
| Tauri app launch | ❌ `tauri.conf.json` references nonexistent `dev:frontend`/`build:frontend` scripts; frontend deps absent from package.json |

---

## 4. GitHub process state (issues / PRs / CI)

- **Open issues:** none.
- **Open PRs (8):** all `mergeable_state: clean` against `main`:
  - **#16** — "Add scoped Agent Memory doctrine backlink" (docs-only, +21 lines, README). Aligns this repo with the agent-memory governance/provenance work.
  - **#11** — cargo: tauri 2.10.3 → 2.11.1 (includes an ACL-enforcement security fix for remote origins).
  - **#12** — cargo: serde_with 3.18 → 3.21.
  - **#6** — npm: vite 5.4 → 8.1 + vitest 1.6 → 4.1 (major).
  - **#4** — npm: esbuild 0.21 → 0.28 (contains dev-server security fixes) + vitest + tsx (overlaps #6 — merging #6 first likely obsoletes part of #4).
  - **#15** postcss, **#14** tar, **#13** brace-expansion (routine).
- **CI: none exists.** The only "workflows" are GitHub's dynamic Dependabot
  and CodeQL scanners. There are no checks on any PR, so "CI passing" is
  vacuously true everywhere. Every dependency bump — including the two major
  vitest/vite jumps — would merge unverified. This is the single most
  important process gap in the repository, and it directly caused the broken
  ESLint state on `main`.

**Recommended merge order** once CI exists: #16 (docs, no risk) → #11/#12
(cargo bumps, verified by `cargo test`) → #6 then rebase/close #4 (vitest 4
migration in one step) → #15/#14/#13.

---

## 5. Core architecture findings (Rust workspace)

Strengths: small single-purpose modules (largest non-test file 250 lines), no
`unsafe`, no TODO/FIXME/`unimplemented!` anywhere, thiserror-typed errors,
deterministic tests with injected clocks, atomic snapshot writes.

Gaps, ordered by product impact:

1. **The only reachable embedding engine is a mock.** `MockEngine` hashes
   content to pseudo-vectors; similarity is semantically meaningless except
   for exact duplicates. The real engine (`ggcore` feature, ONNX embedder) is
   never compiled, never tested, and unreachable from SimpleMemory, the CLI,
   and Tauri without code changes. Every user-facing search result today is a
   hash artifact.
2. **No automatic persistence.** Snapshot-on-demand only; the Tauri app never
   saves on exit — killing it loses all memory since the last explicit
   `save_state`, ledger included. No WAL, no fsync after write/rename.
   Restore requires exact version-string equality (no migration path), and a
   snapshot with an empty `l3_blocks` array panics (`Ledger::from_blocks`
   assert) instead of erroring.
3. **L3 immutability is not enforced.** `l3_vault` exposes `get_mut`, and
   trust updates mutate stored units in place; `verify_integrity()` checks
   only block linkage, never stored entries against their recorded
   `data_hash` — so vault contents can silently diverge from the ledger while
   verification reports success. For an L3-risk-grade "cryptographic memory
   integrity" project, this is the key correctness gap.
4. **Decay never deletes.** `should_prune` filters at query time only; L2/L3
   grow unboundedly. There is no tick/GC/consolidation loop in the Rust code,
   despite the documented `[Tick] → DecayEngine → Promotion → Consolidation`
   flow.
5. **Lifecycle orchestrator and shadow genome are dead at runtime.** Both are
   implemented and tested, but no CLI or Tauri path ever calls
   `begin_operation`/`record_failure` — phases never advance, synthesis never
   runs, and `check_safety` can only ever return Pass.
6. **MTS routing is largely ceremonial** — `accuracy` is a constant 0.5;
   sensitivity/privilege reduce to the literal tag `"sensitive"`.
7. **Scaling ceilings:** linear O(N·d) vector scan per query (no ANN index);
   CLI does full-state JSON read-modify-write per command with no file
   locking (concurrent invocations lose writes); one global tokio mutex
   serializes all Tauri commands.
8. **Minor:** redundant double routing in encode; redundant inner SLO mutex;
   `Representation::as_vector` indexes bytes unchecked (serde-deserialized
   snapshots bypass `from_bytes` validation — a fuzz/property-test target).

The TS-side transformer engine has a related honesty gap: "local-first" is
claimed, but `@huggingface/transformers` downloads `Xenova/all-MiniLM-L6-v2`
from the Hub on first encode — no `allowRemoteModels=false`, no bundled
weights, no cache pre-seeding. (Nearly dead code in practice, since factory
defaults to mock.)

---

## 6. Documentation gaps

- README: placeholder clone URL (`your-org/evolve-ai`), TypeScript-only
  story, no mention of Rust/CLI/Tauri, no GG-CORE submodule instructions
  (`git clone --recurse-submodules` is mandatory), stale test tables, and
  references to renamed `/ql-*` commands.
- CLAUDE.md: stale on nearly every claim (port 4000, STM/LTM naming,
  `src/core/tiers|memory` layout, v1.0.0 lifecycle, path aliases).
- Missing entirely: CONTRIBUTING.md, CHANGELOG.md, SECURITY.md, `.github/`
  (workflows, issue/PR templates), API reference (rustdoc/typedoc), release
  and packaging docs for the CLI and Tauri artifacts.
- Two research docs cited by BACKLOG.md (`EVOLVEAI-VS-MENGRAM-ANALYSIS.md`,
  `AGT-GOVERNANCE-COMPARISON.md`) do not exist in `docs/Research/`.
- `docs/Research/UOR-GITHUB-ISSUE-DRAFT.md` is a finished, unshipped upstream
  deliverable — filing it is a zero-code win.
- `.gitignore` contains duplicated Node boilerplate and VS-Code-extension-era
  leftovers.

---

## 7. Dependency currency (2026 view)

**Rust — good.** Tauri 2.10.3 (current major; #11 bumps to 2.11.1), tokio
1.50, serde current, blake3/uuid/tracing current. Two soft spots: `thiserror`
pinned to major 1 (v2 current since late 2024; both majors compile today) and
edition 2021 (2024 stable since early 2025). gg-core pinned at submodule
`82944e1` (crate 0.8.1).

**npm — behind, and partially unusable.** vitest 1.6 (current major: 4),
vite 5 transitive (current: 8), esbuild 0.21 (security fixes in later
versions), TypeScript ^5 fine, ESLint 10 present but unconfigured. The open
dependabot PRs #4/#6 cover the majors, but merging them without CI or a flat
ESLint config repeats the July mistake.

---

## 8. Proposed roadmap

### Phase 0 — Stabilize (days): make the repo trustworthy
1. **Add CI** (`.github/workflows/ci.yml`): jobs for `cargo fmt --check`,
   `cargo clippy -D warnings`, `cargo test --workspace --exclude evolve-app`
   (or install GTK deps for a full build), `npm test`, `npm run typecheck`,
   `npm run lint`; submodule checkout enabled. Branch protection: require CI
   on `main`.
2. **Fix the npm toolchain**: add flat `eslint.config.js`; fix the 304 tsc
   errors (mostly mechanical `.js` extension additions) or scope `tsc` to the
   active code; drop the `--ext` flag.
3. **Unify versioning to v6.1.0 everywhere** (package.json, evolve-core,
   src-tauri, tauri.conf.json, CLAUDE.md, SYSTEM_STATE.md), commit the
   regenerated Cargo.lock, create annotated git tags going forward, and
   append ledger entries for the post-seal commits.
4. **Merge the open PRs in order** (#16 → cargo bumps → vitest-4 migration)
   once CI can verify them.
5. **Rewrite README + CLAUDE.md** around the Rust workspace: real clone URL,
   `--recurse-submodules`, Linux GTK prerequisites, CLI + Tauri quickstarts,
   TS prototype clearly marked legacy.

### Phase 1 — Make it a product (weeks): close the shell gaps
6. **Resurrect the frontend**: add react/react-dom/@tauri-apps/api/vite (+
   plugin) to package.json, add `dev:frontend`/`build:frontend` scripts,
   verify `tauri dev` end-to-end; extend the UI beyond the 3 v1 commands to
   the full 15-command surface (feedback, dispute, forget, profile, SLO,
   pending crystallizations).
7. **Auto-persistence**: save-on-exit + periodic snapshot (or a small WAL) in
   Tauri; fsync; snapshot version migration instead of exact-match rejection;
   fix the empty-`l3_blocks` panic; file locking for the CLI.
8. **Real embeddings by default**: wire the ggcore ONNX engine (or an
   embedded alternative such as fastembed/ort with a small local model) into
   SimpleMemory/CLI/Tauri behind config; ship or pre-fetch weights to honor
   the local-first claim; add the missing ggcore tests; consider replacing
   the giant GG-CORE vendored dependency with the sliver actually used, or a
   git dependency, so fresh clones build.
9. **Enforce L3 integrity**: remove/gate `get_mut`, re-verify stored entries
   against `data_hash` in `verify_integrity`, model trust updates as new
   chain entries rather than in-place mutation.
10. **Wire the dormant subsystems**: drive lifecycle phases from
    encode/query, call `record_failure` from the frontends so the shadow
    genome and `check_safety` do real work; add a decay tick that actually
    prunes/consolidates.

### Phase 2 — Advance the research agenda (per the project's own backlog)
11. **BL-001 deterministic policy gate** — the root dependency that unblocks
    BL-002, BL-003, and BL-007; restore/author the missing AGT research docs.
12. BL-008 Shapley fault attribution and BL-013 swarm token budget (already
    unblocked by BL-005).
13. Complete BL-004 (cross-model verification engine on the CMVK primitives).
14. File `docs/Research/UOR-GITHUB-ISSUE-DRAFT.md` upstream.
15. Scale path: ANN index (e.g. HNSW) once memory counts exceed ~10⁵.

### Alignment with agent-memory standardization
PR #16's doctrine backlink is the right shape: EvolveAI claims the *memory
metabolism* responsibility (lifecycle, decay, tier routing, consolidation).
The conformance evidence it declares as "none yet" maps directly onto Phase 1
items 9–10 — enforcing ledger integrity and actually running the lifecycle
are precisely what would move that label from `declared` toward conformant.
