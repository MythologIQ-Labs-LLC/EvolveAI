# Plan: v4.0 Tauri v2 Application Shell

## Open Questions

1. **Frontend framework**: Existing shadcn/React components in `components/ui/` or start minimal? **Decision**: Start with minimal Vite + React. The legacy components can be imported later — they're just `.tsx` files.

2. **State management**: `MemoryProcessor<MockEngine>` is generic. Tauri state needs a concrete type. **Decision**: Type-alias `AppProcessor = MemoryProcessor<MockEngine>`, wrap in `Mutex<AppProcessor>` for Tauri managed state.

3. **Workspace layout**: `src-tauri/` (Tauri convention) or `crates/evolve-app/` (workspace convention)? **Decision**: `src-tauri/` — follows Tauri v2 convention, `cargo tauri dev` expects it there.

---

## Phase 1: Tauri v2 Scaffold & Rust Backend

### Affected Files

- `src-tauri/Cargo.toml` — NEW: Tauri app binary crate
- `src-tauri/build.rs` — NEW: Tauri build script
- `src-tauri/tauri.conf.json` — NEW: Tauri window/app configuration
- `src-tauri/capabilities/default.json` — NEW: Tauri v2 permissions
- `src-tauri/src/main.rs` — NEW: Tauri app entry point
- `src-tauri/src/state.rs` — NEW: AppProcessor type alias + init
- `src-tauri/src/commands.rs` — NEW: `#[tauri::command]` IPC wrappers
- `Cargo.toml` — Add `src-tauri` to workspace members

### Changes

**Cargo.toml (workspace root)** — add member:

```toml
[workspace]
members = ["crates/*", "src-tauri"]
```

**src-tauri/Cargo.toml**:

```toml
[package]
name = "evolve-app"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
evolve-core = { path = "../crates/evolve-core" }
```

**src-tauri/build.rs**:

```rust
fn main() {
    tauri_build::build();
}
```

**src-tauri/tauri.conf.json**:

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "EvolveAI",
  "version": "0.1.0",
  "identifier": "com.mythologiq.evolveai",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev:frontend",
    "beforeBuildCommand": "npm run build:frontend"
  },
  "app": {
    "title": "EvolveAI",
    "windows": [
      {
        "title": "EvolveAI - Memory System",
        "width": 1200,
        "height": 800
      }
    ]
  }
}
```

**src-tauri/capabilities/default.json**:

```json
{
  "identifier": "default",
  "description": "Default capability for EvolveAI",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

**src-tauri/src/state.rs**:

```rust
use evolve_core::processor::facade::{MemoryProcessor, ProcessorConfig};
use evolve_core::representation::mock::MockEngine;
use std::sync::Mutex;

/// Concrete processor type for the Tauri app.
pub type AppProcessor = MemoryProcessor<MockEngine>;

/// Initialize the processor with default config.
pub fn create_processor() -> Mutex<AppProcessor> {
    let engine = MockEngine::new(384);
    let config = ProcessorConfig::default();
    Mutex::new(MemoryProcessor::new(engine, config))
}
```

**src-tauri/src/commands.rs**:

```rust
use crate::state::AppProcessor;
use evolve_core::memory::types::*;
use evolve_core::processor::types::ProcessorStats;
use evolve_core::shadow::interceptor::Verdict;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

#[derive(Serialize)]
pub struct EncodeResponse {
    pub uor_id: String,
    pub tier: String,
    pub mts_score: f32,
}

#[derive(Serialize)]
pub struct QueryResponse {
    pub count: usize,
    pub candidates_evaluated: usize,
    pub latency_ms: u64,
}

#[derive(Serialize)]
pub struct SafetyResponse {
    pub passed: bool,
    pub reasoning: Option<String>,
}

#[tauri::command]
pub async fn encode_memory(
    content: String,
    tags: Vec<String>,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<EncodeResponse, String> {
    let input = RawInput {
        content,
        content_type: ContentType::Text,
        metadata: InputMetadata {
            tags,
            source: None,
            priority: Priority::Normal,
            sensitivity: Sensitivity::Public,
        },
    };
    let now = chrono::Utc::now().timestamp_millis();
    let mut proc = processor.lock().map_err(|e| e.to_string())?;
    let result = proc.encode(&input, now).await.map_err(|e| e.to_string())?;

    Ok(EncodeResponse {
        uor_id: result.unit.uor_id.to_string(),
        tier: format!("{:?}", result.decision.tier),
        mts_score: result.decision.mts_score,
    })
}

#[tauri::command]
pub async fn query_memory(
    content: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<QueryResponse, String> {
    let query = Query {
        content,
        constraints: QueryConstraints::default(),
    };
    let now = chrono::Utc::now().timestamp_millis();
    let proc = processor.lock().map_err(|e| e.to_string())?;
    let result = proc.query(&query, now).await.map_err(|e| e.to_string())?;

    Ok(QueryResponse {
        count: result.recall.memories.len(),
        candidates_evaluated: result.recall.metrics.candidates_evaluated,
        latency_ms: result.latency_ms,
    })
}

#[tauri::command]
pub fn get_stats(
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<ProcessorStats, String> {
    let proc = processor.lock().map_err(|e| e.to_string())?;
    Ok(proc.stats())
}

#[tauri::command]
pub async fn check_safety(
    intent: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<SafetyResponse, String> {
    let mut proc = processor.lock().map_err(|e| e.to_string())?;
    let verdict = proc.check_safety(&intent).await.map_err(|e| e.to_string())?;
    match verdict {
        Verdict::Pass => Ok(SafetyResponse { passed: true, reasoning: None }),
        Verdict::Block { reasoning, .. } => Ok(SafetyResponse { passed: false, reasoning: Some(reasoning) }),
    }
}

#[tauri::command]
pub fn health_check(
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<bool, String> {
    let proc = processor.lock().map_err(|e| e.to_string())?;
    Ok(proc.health_check())
}

#[tauri::command]
pub fn save_state(
    path: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();
    let proc = processor.lock().map_err(|e| e.to_string())?;
    proc.save_to_file(std::path::Path::new(&path), now).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_state(
    path: String,
    processor: State<'_, Mutex<AppProcessor>>,
) -> Result<(), String> {
    let mut proc = processor.lock().map_err(|e| e.to_string())?;
    proc.load_from_file(std::path::Path::new(&path)).map_err(|e| e.to_string())
}
```

**src-tauri/src/main.rs**:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;

fn main() {
    tauri::Builder::default()
        .manage(state::create_processor())
        .invoke_handler(tauri::generate_handler![
            commands::encode_memory,
            commands::query_memory,
            commands::get_stats,
            commands::check_safety,
            commands::health_check,
            commands::save_state,
            commands::load_state,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
```

### Unit Tests

No Rust tests for Phase 1 — Tauri command wrappers are thin delegation to `evolve-core` (which has 95 tests). Verification is: `cargo tauri build` succeeds.

---

## Phase 2: Minimal Frontend

### Affected Files

- `index.html` — NEW: Vite entry point
- `ui/main.tsx` — NEW: React entry point
- `ui/App.tsx` — NEW: Minimal app with encode/query/stats
- `vite.config.ts` — NEW: Vite config for Tauri
- `package.json` — Update scripts and deps

### Changes

**package.json** — update scripts and add Tauri/Vite deps:

```json
{
  "scripts": {
    "dev:frontend": "vite",
    "build:frontend": "vite build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "test": "vitest run"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0"
  }
}
```

**vite.config.ts**:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
```

**index.html**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EvolveAI</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/ui/main.tsx"></script>
</body>
</html>
```

**ui/main.tsx**:

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
```

**ui/App.tsx** — minimal functional UI:

```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function App() {
  const [content, setContent] = useState("");
  const [result, setResult] = useState<string>("");
  const [stats, setStats] = useState<string>("");

  async function handleEncode() {
    const res = await invoke("encode_memory", { content, tags: [] });
    setResult(JSON.stringify(res, null, 2));
  }

  async function handleQuery() {
    const res = await invoke("query_memory", { content });
    setResult(JSON.stringify(res, null, 2));
  }

  async function handleStats() {
    const res = await invoke("get_stats");
    setStats(JSON.stringify(res, null, 2));
  }

  return (
    <div style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>EvolveAI</h1>
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Enter content..."
        style={{ width: 400, padding: 8 }}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={handleEncode}>Encode</button>
        <button onClick={handleQuery}>Query</button>
        <button onClick={handleStats}>Stats</button>
      </div>
      {result && <pre style={{ marginTop: 16 }}>{result}</pre>}
      {stats && <pre style={{ marginTop: 16 }}>{stats}</pre>}
    </div>
  );
}
```

### Unit Tests

No frontend tests in Phase 2 — minimal viable UI. Verification: `npm run tauri:dev` launches the app.

---

## Summary

| Phase | Focus | New Files | Changes |
|-------|-------|-----------|---------|
| 1 | Tauri scaffold + IPC commands | 8 new | 1 modified (workspace Cargo.toml) |
| 2 | Minimal Vite + React frontend | 4 new | 1 modified (package.json) |

### Design Principles Applied

1. **Simple over Easy**: Thin command wrappers — no business logic in Tauri layer
2. **Composable**: `evolve-core` is consumed as a dependency, not modified
3. **No complecting**: Tauri state (Mutex) is isolated in `state.rs`, commands in `commands.rs`
4. **Declarative**: `tauri.conf.json` declares app config, commands declare IPC surface

---

_Plan follows Simple Made Easy principles_
