/**
 * Control-panel sections, one per functional area of the Tauri command surface.
 */
import { useState } from "react";
import * as api from "./api";
import { Badge, KV, Output, Row, Section, useCall } from "./common";

// ---------------------------------------------------------------------------
// Memory: encode, query, ingest, forget, related
// ---------------------------------------------------------------------------

/** Ranked query matches. Content itself is not stored by the core (memories
 *  are content-addressed hashes + embeddings), so source/tags stand in. */
function ResultsTable(props: { results: api.QueryMatch[] }) {
  if (props.results.length === 0) {
    return <div className="muted">No matches.</div>;
  }
  return (
    <table className="results">
      <thead>
        <tr>
          <th>Tier</th>
          <th>Score</th>
          <th>Saturation</th>
          <th>Source / tags</th>
          <th>Address</th>
        </tr>
      </thead>
      <tbody>
        {props.results.map((m) => (
          <tr key={m.address}>
            <td>
              <span className="badge badge-tier">{m.tier}</span>
            </td>
            <td>{m.score.toFixed(4)}</td>
            <td>{m.saturation.toFixed(4)}</td>
            <td className="results-source">
              {m.source ?? <span className="muted">—</span>}
              {m.tags.length > 0 && (
                <div className="muted">{m.tags.join(", ")}</div>
              )}
            </td>
            <td>
              <code title={m.address}>{m.address.slice(0, 12)}…</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MemoryPanel() {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [address, setAddress] = useState("");
  const [ingestPath, setIngestPath] = useState("");
  const encode = useCall<api.EncodeResponse>();
  const query = useCall<api.QueryResponse>();
  const ingest = useCall<api.IngestResponse>();
  const forget = useCall<boolean>();
  const related = useCall<string[]>();

  const parsedTags = () =>
    tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

  return (
    <Section title="Memory">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Content to encode, or query text..."
        rows={3}
      />
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="Tags (comma-separated, encode only)"
      />
      <Row>
        <button onClick={() => encode.run(() => api.encodeMemory(content, parsedTags()))}>
          Encode
        </button>
        <button onClick={() => query.run(() => api.queryMemory(content))}>Query</button>
      </Row>
      <Output
        state={encode.state}
        render={(r) => (
          <KV
            items={[
              ["Address", <code key="a">{r.address}</code>],
              ["Tier", r.tier],
              ["MTS score", r.mts_score.toFixed(4)],
            ]}
          />
        )}
      />
      <Output
        state={query.state}
        render={(r) => (
          <>
            <KV
              items={[
                ["Matches", r.count],
                ["Candidates evaluated", r.candidates_evaluated],
                ["Latency", `${r.latency_ms} ms`],
              ]}
            />
            <ResultsTable results={r.results} />
          </>
        )}
      />
      <Row>
        <input
          value={ingestPath}
          onChange={(e) => setIngestPath(e.target.value)}
          placeholder="File path to ingest (chunked into memories)"
        />
        <button onClick={() => ingest.run(() => api.ingestFile(ingestPath))}>
          Ingest
        </button>
      </Row>
      <Output
        state={ingest.state}
        render={(r) => (
          <KV
            items={[
              ["Source", r.source],
              ["Chunks encoded", r.chunks],
              ["Units created", r.addresses.length],
            ]}
          />
        )}
      />
      <Row>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Memory address (UOR)"
        />
        <button onClick={() => forget.run(() => api.forgetMemory(address))}>Forget</button>
        <button onClick={() => related.run(() => api.getRelated(address))}>Related</button>
      </Row>
      <Output
        state={forget.state}
        render={(found) => <Badge ok={found} yes="Forgotten" no="Address not found" />}
      />
      <Output
        state={related.state}
        render={(addrs) =>
          addrs.length === 0 ? (
            <div className="muted">No related memories.</div>
          ) : (
            <ul className="addr-list">
              {addrs.map((a) => (
                <li key={a}>
                  <code>{a}</code>
                </li>
              ))}
            </ul>
          )
        }
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Trust & Crystallization: feedback, dispute, approve, pending
// ---------------------------------------------------------------------------

export function TrustPanel() {
  const [address, setAddress] = useState("");
  const [event, setEvent] = useState<api.PinningEvent>("access");
  const [severity, setSeverity] = useState("0.5");
  const fb = useCall<api.FeedbackResponse>();
  const disp = useCall<number | null>();
  const approve = useCall<boolean>();
  const pending = useCall<string[]>();

  return (
    <Section title="Trust & Crystallization">
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Memory address (UOR)"
      />
      <Row>
        <select value={event} onChange={(e) => setEvent(e.target.value as api.PinningEvent)}>
          {api.PINNING_EVENTS.map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </select>
        <button onClick={() => fb.run(() => api.feedback(address, event))}>Feedback</button>
      </Row>
      <Output
        state={fb.state}
        render={(r) => <Badge ok={r.found} yes="Recorded" no="Address not found" />}
      />
      <Row>
        <input
          type="number"
          min="0"
          max="1"
          step="0.1"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        />
        <button onClick={() => disp.run(() => api.dispute(address, Number(severity)))}>
          Dispute
        </button>
        <button onClick={() => approve.run(() => api.approveCrystallization(address))}>
          Approve crystallization
        </button>
      </Row>
      <Output
        state={disp.state}
        render={(trust) =>
          trust === null ? (
            <div className="muted">Address not found.</div>
          ) : (
            <KV items={[["New trust", trust.toFixed(4)]]} />
          )
        }
      />
      <Output
        state={approve.state}
        render={(ok) => <Badge ok={ok} yes="Crystallized" no="Not pending / not found" />}
      />
      <Row>
        <button onClick={() => pending.run(() => api.getPending())}>
          List pending crystallizations
        </button>
      </Row>
      <Output
        state={pending.state}
        render={(addrs) =>
          addrs.length === 0 ? (
            <div className="muted">No pending crystallizations.</div>
          ) : (
            <ul className="addr-list">
              {addrs.map((a) => (
                <li key={a}>
                  <button className="link" onClick={() => setAddress(a)}>
                    use
                  </button>{" "}
                  <code>{a}</code>
                </li>
              ))}
            </ul>
          )
        }
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Profile & SLO
// ---------------------------------------------------------------------------

export function ProfilePanel() {
  const profile = useCall<api.ProfileResponse>();
  const slo = useCall<api.SloResponse>();

  return (
    <Section title="Profile & SLO">
      <Row>
        <button
          onClick={() => {
            void profile.run(() => api.getProfile());
            void slo.run(() => api.getSloReport());
          }}
        >
          Refresh
        </button>
      </Row>
      <Output
        state={profile.state}
        render={(p) => (
          <>
            <p className="muted">{p.summary}</p>
            <KV
              items={[
                ["Total memories", p.total_memories],
                ["L1 / L2 / L3", `${p.l1_count} / ${p.l2_count} / ${p.l3_count}`],
                ["Avg saturation", p.avg_saturation.toFixed(4)],
                ["Crystallized", p.crystallized_count],
                [
                  "Top tags",
                  p.top_tags.length === 0
                    ? "—"
                    : p.top_tags.map(([t, n]) => `${t} (${n})`).join(", "),
                ],
              ]}
            />
          </>
        )}
      />
      <Output
        state={slo.state}
        render={(r) => (
          <KV
            items={[
              ["Circuit", <Badge key="c" ok={!r.circuit_open} yes="closed" no="OPEN" />],
              ["Violations", r.violation_count],
              ["Budget remaining", r.budget_remaining.toFixed(4)],
              ["Pressure", r.pressure.toFixed(4)],
              ["Adjusted half-life", `${r.adjusted_half_life_ms} ms`],
            ]}
          />
        )}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Safety: shadow-genome probe
// ---------------------------------------------------------------------------

export function SafetyPanel() {
  const [intent, setIntent] = useState("");
  const check = useCall<api.SafetyResponse>();

  return (
    <Section title="Safety">
      <Row>
        <input
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="Intent to probe against the Shadow Genome"
        />
        <button onClick={() => check.run(() => api.checkSafety(intent))}>Check</button>
      </Row>
      <Output
        state={check.state}
        render={(r) => (
          <>
            <Badge ok={r.passed} yes="Pass" no="Blocked" />
            {r.reasoning && <pre className="output">{r.reasoning}</pre>}
          </>
        )}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Persistence: save / load state to a file path
// ---------------------------------------------------------------------------

export function PersistencePanel() {
  const [path, setPath] = useState("");
  const save = useCall<void>();
  const load = useCall<void>();

  return (
    <Section title="Persistence">
      <Row>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="File path, e.g. ~/.evolve/memory.json"
        />
        <button onClick={() => save.run(() => api.saveState(path))}>Save</button>
        <button onClick={() => load.run(() => api.loadState(path))}>Load</button>
      </Row>
      <Output state={save.state} render={() => <Badge ok yes="Saved" no="" />} />
      <Output state={load.state} render={() => <Badge ok yes="Loaded" no="" />} />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Metabolism: decay tick, detach (REM synthesis), shadow genome stats
// ---------------------------------------------------------------------------

/** "IntegrationFailure" -> "Integration failure". */
function humanizeCategory(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0) + spaced.slice(1).toLowerCase();
}

function DecayReport(props: { report: api.DecayTickResponse }) {
  const r = props.report;
  return (
    <KV
      items={[
        ["L1", `${r.l1_examined} examined, ${r.l1_evicted} evicted`],
        [
          "L2",
          `${r.l2_examined} examined, ${r.l2_pruned} pruned, ${r.l2_promoted} promoted`,
        ],
        ["L3", `${r.l3_examined} examined (never pruned)`],
      ]}
    />
  );
}

export function MetabolismPanel() {
  const tick = useCall<api.DecayTickResponse>();
  const det = useCall<api.DetachResponse>();
  const shadow = useCall<api.ShadowStatsResponse>();

  return (
    <Section title="Metabolism">
      <Row>
        <button onClick={() => tick.run(() => api.runDecayTick())}>Decay tick</button>
        <button onClick={() => det.run(() => api.detach())}>Detach</button>
        <button onClick={() => shadow.run(() => api.getShadowStats())}>
          Shadow Genome stats
        </button>
      </Row>
      <Output state={tick.state} render={(r) => <DecayReport report={r} />} />
      <Output
        state={det.state}
        render={(r) => (
          <>
            {r.synthesized ? (
              <Badge ok yes={`Synthesized (${r.traces_processed} traces processed)`} no="" />
            ) : (
              <div className="muted">
                Detached — trace count below synthesis threshold; no REM pass.
              </div>
            )}
            {r.decay && <DecayReport report={r.decay} />}
          </>
        )}
      />
      <Output
        state={shadow.state}
        render={(s) => (
          <KV
            items={[
              ["Entries (total / active)", `${s.total_entries} / ${s.active_entries}`],
              ["Total triggers", s.total_triggers],
              [
                "By category",
                s.by_category.length === 0 ? (
                  "—"
                ) : (
                  <ul className="addr-list" key="cats">
                    {s.by_category.map(([cat, n]) => (
                      <li key={cat}>
                        {humanizeCategory(cat)}: {n}
                      </li>
                    ))}
                  </ul>
                ),
              ],
            ]}
          />
        )}
      />
    </Section>
  );
}
