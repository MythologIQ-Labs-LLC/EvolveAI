/**
 * Small shared primitives for the control panel: a per-call async state hook
 * and a handful of presentational components. No UI libraries.
 */
import { useCallback, useState, type ReactNode } from "react";

export type CallState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; error: string };

/** Tracks loading / result / error for a single backend call. */
export function useCall<T>() {
  const [state, setState] = useState<CallState<T>>({ status: "idle" });
  const run = useCallback(async (fn: () => Promise<T>): Promise<T | undefined> => {
    setState({ status: "loading" });
    try {
      const data = await fn();
      setState({ status: "ok", data });
      return data;
    } catch (e) {
      setState({ status: "error", error: String(e) });
      return undefined;
    }
  }, []);
  const reset = useCallback(() => setState({ status: "idle" }), []);
  return { state, run, reset };
}

export function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}

export function Row(props: { children: ReactNode }) {
  return <div className="row">{props.children}</div>;
}

/** Renders a call's outcome: nothing when idle, spinner text, error, or data. */
export function Output<T>(props: {
  state: CallState<T>;
  render?: (data: T) => ReactNode;
}) {
  const { state, render } = props;
  if (state.status === "idle") return null;
  if (state.status === "loading") return <div className="muted">Working...</div>;
  if (state.status === "error") return <pre className="error">{state.error}</pre>;
  if (render) return <>{render(state.data)}</>;
  return <pre className="output">{JSON.stringify(state.data, null, 2)}</pre>;
}

/** Definition list for key/value result display. */
export function KV(props: { items: [string, ReactNode][] }) {
  return (
    <table className="kv">
      <tbody>
        {props.items.map(([k, v]) => (
          <tr key={k}>
            <td className="kv-key">{k}</td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Badge(props: { ok: boolean; yes: string; no: string }) {
  return (
    <span className={props.ok ? "badge badge-ok" : "badge badge-bad"}>
      {props.ok ? props.yes : props.no}
    </span>
  );
}
