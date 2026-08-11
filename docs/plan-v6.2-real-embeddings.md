# Plan: v6.2 Real Embeddings (GG-CORE ONNX as default engine)

Decision record (2026-08-11): engine strategy = GG-CORE ONNX (vendored
runtime, no third-party inference deps); weights ship bundled in release
artifacts (local-first); MockEngine remains for tests and as explicit
fallback.

## Open Questions

1. **GG-CORE's OnnxEmbedder is a stub.** `core-runtime/src/engine/onnx/embedder.rs`
   holds `_model: Option<()>` and `embed_text` unconditionally errors
   ("ONNX model not loaded"). Real inference must be implemented **in the
   GG-CORE repository** (Phase 1 below is cross-repo work under GG-CORE's
   own `/ql-*` governance and offline constraints), then the submodule pin
   updated here. EvolveAI-side phases are blocked until that lands.
2. **Model choice**: all-MiniLM-L6-v2 ONNX (384 dims — matches every
   default dimension already in this codebase) at int8 quantization
   (~23 MB) vs fp32 (~90 MB). Plan assumes **int8**; flip to fp32 only if
   quantized similarity quality regresses on the golden-vector suite.
3. **Existing stores cannot be re-embedded.** MemoryUnits keep only the
   content address + embedding, never raw text. Mixed-engine stores are
   detectable (`Representation.model_id` is persisted per unit). Plan:
   query-time similarity is only computed between representations with
   matching `model_id`; foreign-model units decay naturally. No migration.

## Phase 1: GG-CORE ONNX inference (in vendor/GG-CORE repository)

### Affected Files (GG-CORE repo, `core-runtime/`)

- `src/engine/onnx/embedder_tests.rs` — **NEW**: golden-vector tests
- `src/engine/onnx/embedder.rs` — real model load + inference
- `src/engine/onnx/tokenize.rs` — **NEW**: tokenizer wrapper
- `Cargo.toml` — `onnx` feature gains `candle-onnx` (or `ort`), `tokenizers`

### Changes

`OnnxEmbedder::load(model_dir: &Path, model_id, dims) -> Result<Self>`:
reads `<model_dir>/<model_id>/model.onnx` + `tokenizer.json` (respects
GG-CORE's filesystem boundary: read-only `models/`). `embed_text`:
tokenize → run session → mean-pool last hidden state over attention mask
→ L2-normalize → `EmbeddingResult`. `TextBatch` embeds every item (fixes
the "first item only" stub). `memory_bytes` tracks the loaded session.
`unload` drops the session.

### Unit Tests

- `embedder_tests.rs` — golden vectors: fixed input strings must produce
  embeddings within 1e-3 of committed reference values (fixture model in
  `models/test/`); determinism across two loads; batch == per-item
  results; unloaded embedder still errors cleanly.

## Phase 2: Engine selection in evolve-core

### Affected Files

- `crates/evolve-core/src/representation/tests.rs` — engine-dispatch tests first
- `crates/evolve-core/src/representation/either.rs` — **NEW**: `AnyEngine`
- `crates/evolve-core/src/representation/factory.rs` — construction from config
- `crates/evolve-core/src/simple/mod.rs` — `SimpleMemory` over `AnyEngine`
- `crates/evolve-core/Cargo.toml` — nothing new; `ggcore` feature unchanged
- `Cargo.toml` (workspace) + `.github/workflows/ci.yml` — CI job compiles
  and tests `--features ggcore`

### Changes

`RepresentationEngine` uses RPITIT (not dyn-compatible), so dispatch is a
closed enum, not a trait object: `enum AnyEngine { Mock(MockEngine),
#[cfg(feature = "ggcore")] GgCore(GgCoreEngine) }` implementing
`RepresentationEngine` by delegation. `EngineConfig { kind: EngineKind,
model_dir: Option<PathBuf>, model_id: String, dimensions: usize }`
(serde). `factory::create(config) -> Result<AnyEngine, EngineError>`:
GgCore kind with missing weights returns a typed error naming the
expected path — callers decide whether to fall back. `SimpleMemory`
stores `MemoryProcessor<AnyEngine>`; `SimpleMemory::new()` keeps Mock;
`SimpleMemory::with_engine(AnyEngine, config)` added.

### Unit Tests

- `representation/tests.rs` — AnyEngine delegates model_id/capabilities/
  encode for Mock; ggcore-feature test: missing model dir yields the
  typed error (no weights in CI unit tests); cross-model similarity is
  refused (model_id mismatch returns no score, not a bogus one — this
  test drives the decoder guard in query scoring).

## Phase 3: CLI and Tauri adoption

### Affected Files

- `crates/evolve-cli/tests/cli.rs` — engine-selection tests first
- `crates/evolve-cli/src/main.rs` (or its modules) — engine resolution
- `src-tauri/src/state.rs`, `src-tauri/src/main.rs` — engine resolution
- `ui/api.ts`, `ui/App.tsx` — surface active engine in stats/status bar

### Changes

Engine resolution order (shared logic, duplicated thinly per frontend to
avoid a new crate): `EVOLVE_ENGINE=mock|ggcore` env → `~/.evolve/config.json`
`engine` block → default `ggcore` when the feature is compiled AND weights
resolve at `~/.evolve/models/`; otherwise Mock with a one-line stderr
warning naming the missing path ("semantic search degraded: mock engine").
`get_stats`/CLI `profile` include `engine: <model_id>`. Weight bundling
into release artifacts is owned by plan-v6.4 (the installer/bundle places
weights under `~/.evolve/models/` or app-resource dir).

### Unit Tests

- `cli.rs` — `EVOLVE_ENGINE=mock` forced mock; ggcore requested but
  weights absent → warning on stderr + functional mock fallback; stats
  output names the active engine.

## CI validation

`cargo test -p evolve-core -p evolve-cli`, `cargo test -p evolve-core
--features ggcore`, `cargo clippy -p evolve-core -p evolve-cli --features
ggcore -- -D warnings`, `cargo check -p evolve-app`, `cargo fmt -p
evolve-core -p evolve-cli -p evolve-app --check`.
