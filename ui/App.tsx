/**
 * EvolveAI desktop control panel. Wires the full Tauri command surface
 * (see src-tauri/src/main.rs) into one dependency-light React page.
 */
import * as api from "./api";
import { Badge, KV, Output, Row, useCall } from "./common";
import {
  MemoryPanel,
  MetabolismPanel,
  PersistencePanel,
  ProfilePanel,
  SafetyPanel,
  TrustPanel,
} from "./panels";
import "./styles.css";

function StatusBar() {
  const health = useCall<boolean>();
  const stats = useCall<api.StatsResponse>();

  return (
    <header className="statusbar">
      <div>
        <h1>EvolveAI</h1>
        <p className="muted">Autopoietic Memory System — control panel</p>
      </div>
      <Row>
        <button onClick={() => health.run(() => api.healthCheck())}>Health check</button>
        <button onClick={() => stats.run(() => api.getStats())}>Refresh stats</button>
      </Row>
      <Output
        state={health.state}
        render={(ok) => <Badge ok={ok} yes="Healthy" no="Unhealthy" />}
      />
      <Output
        state={stats.state}
        render={(s) => (
          <KV
            items={[
              ["L1 size", s.l1_size],
              ["L2 nodes / edges", `${s.l2_nodes} / ${s.l2_edges}`],
              ["L3 size", s.l3_size],
              ["L3 chain length", s.l3_chain_length],
              [
                "L3 integrity",
                <Badge key="i" ok={s.l3_integrity} yes="intact" no="BROKEN" />,
              ],
              ["Phase", s.phase],
              ["Traces", s.trace_count],
            ]}
          />
        )}
      />
    </header>
  );
}

export function App() {
  return (
    <div className="app">
      <StatusBar />
      <main className="grid">
        <MemoryPanel />
        <TrustPanel />
        <MetabolismPanel />
        <ProfilePanel />
        <SafetyPanel />
        <PersistencePanel />
      </main>
    </div>
  );
}
