/**
 * Control-panel sections, one per functional area of the Tauri command surface.
 */
import { useState } from "react";
import * as api from "./api";
import { Badge, KV, Output, Row, Section, useCall } from "./common";

// ---------------------------------------------------------------------------
// Memory: encode, query, forget, related
// ---------------------------------------------------------------------------

export function MemoryPanel() {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [address, setAddress] = useState("");
  const encode = useCall<api.EncodeResponse>();
  const query = useCall<api.QueryResponse>();
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
          <KV
            items={[
              ["Matches", r.count],
              ["Candidates evaluated", r.candidates_evaluated],
              ["Latency", `${r.latency_ms} ms`],
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
