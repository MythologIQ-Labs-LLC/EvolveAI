# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EvolveAI is an exploration into theoretical agentic memory architecture—a learning computer that evolves its own neural network-like memory structures. This is research-grade software focused on memory systems, not a chatbot or assistant.

**Vibe**: Adaptive, Accountable, Retrievable

## Anti-Goals

- **Not a chatbot/assistant** - Memory research, not conversational AI
- **Not cloud-dependent** - All core functionality operates locally
- **Not a static database** - Memory must evolve, decay, and restructure

## Two Codebases, One Repo

The active product is the **Rust workspace**; the TypeScript prototype (v1.0–v2.1) is **frozen** and kept for reference only.

| Location | What it is |
|----------|------------|
| `crates/evolve-core` | Rust core: thermodynamic memory model (decay, trust, zero-trust crystallization, hash-chained ledger) |
| `crates/evolve-cli` | CLI binary (`evolve-cli`): 9 commands over persistent state in `~/.evolve/memory.json` |
| `src-tauri/` | Tauri 2 desktop shell (crate `evolve-app`); frontend build wiring currently incomplete |
| `ui/` | React frontend entry for the Tauri shell |
| `src/`, `lib/`, `components/` | Legacy TypeScript prototype — frozen since 2026-03-18; 164 vitest tests |
| `docs/` | Theory, plans (`plan-*.md`), BACKLOG, META_LEDGER (governance chain — never hand-edit) |
| `vendor/GG-CORE` | Git submodule; **required** path dependency (`vendor/GG-CORE/core-runtime`) — clone with `--recurse-submodules` |

## Development Commands

```bash
# Rust (the product)
cargo test -p evolve-core -p evolve-cli   # Run core + CLI tests
cargo run -p evolve-cli -- help           # Run the CLI
cargo build -p evolve-app                 # Tauri shell (needs GTK/WebKit libs on Linux)

# Legacy TypeScript prototype
npm install
npm test             # 164 vitest tests (frozen prototype)
npm run typecheck    # Currently broken (see docs/REPO_REVIEW-2026-08-11.md)
npm run lint         # Currently broken (no flat ESLint config)
```

## Architecture

See [docs/ARCHITECTURE_PLAN.md](docs/ARCHITECTURE_PLAN.md) and [docs/REPO_REVIEW-2026-08-11.md](docs/REPO_REVIEW-2026-08-11.md).

### Memory Tiers (Rust core, `crates/evolve-core/src/tiers/`)

| Tier | Name | Behavior |
|------|------|----------|
| L1 | Transient Cache | Fast vector cache, TTL eviction, aggressive decay |
| L2 | Temporal Graph | CMHL decay, associative edges |
| L3 | UOR Vault | Immutable hash chain, crystallized memories (λ = 0) |

Other core modules: `chain/` (hash-chained ledger), `memory/` (encoding/decay), `shadow/` (Shadow Genome safety), `lifecycle/` (5-phase orchestrator), `simple/` (SimpleMemory facade used by CLI and Tauri), `processor/`, `representation/`.

## QoreLogic A.E.G.I.S. Status

- **Genesis Hash**: `ece694ee280ee892649d195e6393e979cad072b076afa973816e925f01eb28b4`
- **Final Hash**: `f7d1a3ebe0833ba387f75ac00612de02440f739181c02fc947410f39d52838a8` (last recorded chain hash, Entry #80; the v6.1.0 seal entry #81 records no chain hash)
- **Risk Grade**: L3 (cryptographic memory integrity)
- **Lifecycle**: RELEASED (v6.1.0)
- **License**: Apache-2.0

The command family is `/qor-*` (e.g. `/qor-audit`, `/qor-substantiate`). Never hand-edit `docs/META_LEDGER.md`.

## Path Aliases (legacy TS side)

- `@/*` → `./src/*` (see `tsconfig.json`)

## Windows code signing

Windows binaries and installers this repository distributes **must be Authenticode-signed at release time** with the MythologIQ Labs Azure Artifact Signing profile. Signing is available and verified, so don't ship an unsigned public Windows release.

- Endpoint `https://eus.codesigning.azure.net/`, account `MythologIQ-Labs-Signing`, certificate profile `mythologiq-labs-public-release` (Public Trust). Publisher shown to users: `MythologIQ Labs, LLC`. Timestamp server: `http://timestamp.acs.microsoft.com`.
- Canonical procedure, verified tooling and framework integration: `MythologIQ-Labs-LLC/Myth-Tech-Forge` at `docs/WINDOWS_CODE_SIGNING_STANDARD.md`. Follow it; don't invent another signing path.
- Sign release builds only (release tag or manual release), never PR or routine CI builds. Windows runners bill at 2x Actions minutes.
- Signing requires the Artifact Signing Certificate Profile Signer role. Today only the owner's local `az login` identity has it. A CI signing identity (GitHub OIDC) doesn't exist yet, and creating one, or any secret or role assignment, needs owner approval. Never commit credentials.
- A release is signed only after `signtool verify /pa` passes, the signer is `MythologIQ Labs, LLC`, and the signature is timestamped. Record that output in the release evidence.

**This repository (Tauri):** when producing Windows bundles, sign them through `bundle.windows.signCommand` in a release-only Tauri config, as the standard describes.
