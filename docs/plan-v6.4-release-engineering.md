# Plan: v6.4 Governance Re-seal & Release Engineering

Decision record (2026-08-11): release targets are **Linux + Windows**
(CLI binaries + Tauri bundles); macOS deferred until a signing story
exists. Embedding weights ship **bundled in artifacts** (per
plan-v6.2 decision).

## Open Questions

1. **Ledger catch-up scope**: the META_LEDGER chain is sealed at v6.1.0
   (entry #81, no chain hash recorded) while main + this branch carry
   substantial post-seal history. Re-seal via `/qor-substantiate` as one
   session-seal entry covering the branch, or one entry per release
   commit? Plan assumes one session seal + one entry per future release.
2. **SNAPSHOT_VERSION policy**: constant stays "5.0.0" until the snapshot
   format actually breaks; releases and snapshot format version are
   decoupled on purpose. Confirm.
3. **Windows CLI + bundled weights**: NSIS installer vs portable zip.
   Plan assumes Tauri's default NSIS for the app, portable zip for the CLI.

## Phase 1: Governance chain catch-up

### Affected Files

- `crates/xtask/` — **NEW**: workspace tool (`cargo xtask chain-verify`,
  `chain-append`) porting scripts/*.ps1 hashing to portable Rust
- `crates/xtask/src/chain_tests.rs` — hash-compat tests first
- `docs/META_LEDGER.md` — appended entries (via tooling ONLY)
- `.github/workflows/ci.yml` — chain-verify job
- `scripts/chain-hash.ps1`, `scripts/compute-hash.ps1` — deleted after
  parity is proven

### Changes

`xtask chain-verify` recomputes the META_LEDGER hash chain and fails on
divergence; `chain-append` writes a new entry with computed hash.
Hashing must reproduce the PowerShell scheme byte-for-byte (fixtures
from existing ledger entries prove parity) — but note the .ps1 scripts
hash only `src/**/*.ts`; xtask extends coverage to the Rust workspace
(documented in the appended entry so the scheme change is itself
ledgered). Then: seal the current session (`/qor-substantiate`) and
append entries for the four unrecorded post-seal commits.

### Unit Tests

- `chain_tests.rs` — recompute entries #1..#80 from fixture data and
  match recorded hashes; tamper fixture fails; append round-trips.

## Phase 2: Repository hygiene documents

### Affected Files

- `CHANGELOG.md` — **NEW**: v1.0→current summarized from META_LEDGER;
  Keep-a-Changelog format forward
- `CONTRIBUTING.md` — **NEW**: build prereqs (submodule, GTK, Node),
  gates (the exact CI commands), qor-* governance flow, plan-doc process
- `SECURITY.md` — **NEW**: report channel; scope note (local-first, no
  service endpoints; integrity-of-ledger threat model)
- `.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`, `.github/pull_request_template.md` — **NEW**
- `README.md` — badges (CI, license), release install instructions

### Changes

Content only; no code. PR template's checklist mirrors the CI gates so
contributors self-check before pushing.

## Phase 3: Release pipeline

### Affected Files

- `.github/workflows/release.yml` — **NEW**: tag-triggered (`v*`)
- `src-tauri/tauri.conf.json` — bundle config (icons, NSIS/deb/AppImage
  targets, resources: embedding model weights)
- `scripts/fetch-model.sh` — **NEW**: pinned-hash download of the ONNX
  model + tokenizer into the build tree (CI-time, not user-time)

### Changes

Matrix: {ubuntu-latest, windows-latest} × {cli, app}. CLI: `cargo build
--release -p evolve-cli --features ggcore`, package binary + weights
(zip/tar.gz) + SHA256SUMS. App: `tauri build` producing deb + AppImage
(Linux), NSIS (Windows), weights as bundled resources resolving to the
app resource dir (plan-v6.2 Phase 3's resolution order picks them up).
Artifacts + checksums uploaded to the GitHub Release for the tag;
release body generated from CHANGELOG section. Version bump procedure:
one commit updates package.json + all three crate versions + CHANGELOG,
tag `vX.Y.Z`, ledger entry appended via xtask.

### Unit Tests

- CI dry-run job on PRs touching release.yml: runs the matrix build
  steps without publishing (workflow_dispatch + upload-artifact only),
  asserting bundle outputs exist.

## CI validation

Standing ci.yml gates + `cargo xtask chain-verify` + release.yml
dry-run. Branch protection (admin, manual): require rust, tauri, node,
chain-verify checks on main.
