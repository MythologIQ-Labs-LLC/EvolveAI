import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function App() {
  const [content, setContent] = useState("");
  const [result, setResult] = useState("");
  const [stats, setStats] = useState("");

  async function handleEncode() {
    try {
      const res = await invoke("encode_memory", { content, tags: [] });
      setResult(JSON.stringify(res, null, 2));
    } catch (e) {
      setResult(String(e));
    }
  }

  async function handleQuery() {
    try {
      const res = await invoke("query_memory", { content });
      setResult(JSON.stringify(res, null, 2));
    } catch (e) {
      setResult(String(e));
    }
  }

  async function handleStats() {
    try {
      const res = await invoke("get_stats");
      setStats(JSON.stringify(res, null, 2));
    } catch (e) {
      setStats(String(e));
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 800 }}>
      <h1>EvolveAI</h1>
      <p style={{ color: "#888" }}>Autopoietic Memory System</p>
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Enter content..."
        style={{ width: "100%", padding: 8, fontSize: 14 }}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={handleEncode}>Encode</button>
        <button onClick={handleQuery}>Query</button>
        <button onClick={handleStats}>Stats</button>
      </div>
      {result && (
        <pre style={{ marginTop: 16, background: "#f5f5f5", padding: 12 }}>
          {result}
        </pre>
      )}
      {stats && (
        <pre style={{ marginTop: 16, background: "#eef", padding: 12 }}>
          {stats}
        </pre>
      )}
    </div>
  );
}
