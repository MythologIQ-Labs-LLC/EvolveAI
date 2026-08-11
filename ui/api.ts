/**
 * Typed wrappers over the Tauri command surface (src-tauri/src/main.rs).
 * Every Rust command arg is a single word, so no camelCase remapping applies.
 */
import { invoke } from "@tauri-apps/api/core";

export interface EncodeResponse {
  address: string;
  tier: string;
  mts_score: number;
}

/**
 * One ranked match. The core stores memories content-addressed (BLAKE3
 * address + embedding); raw text is never retained, so source/tags are the
 * human-readable handles.
 */
export interface QueryMatch {
  address: string;
  tier: string;
  score: number;
  decayed_weight: number;
  saturation: number;
  source: string | null;
  tags: string[];
}

export interface QueryResponse {
  count: number;
  candidates_evaluated: number;
  latency_ms: number;
  /** Ranked matches, best first (decoder top-k order). */
  results: QueryMatch[];
}

export interface SafetyResponse {
  passed: boolean;
  reasoning: string | null;
}

export interface StatsResponse {
  l1_size: number;
  l2_nodes: number;
  l2_edges: number;
  l3_size: number;
  l3_chain_length: number;
  l3_integrity: boolean;
  phase: string;
  trace_count: number;
}

export interface FeedbackResponse {
  found: boolean;
}

export interface ProfileResponse {
  total_memories: number;
  l1_count: number;
  l2_count: number;
  l3_count: number;
  avg_saturation: number;
  crystallized_count: number;
  top_tags: [string, number][];
  summary: string;
}

export interface SloResponse {
  violation_count: number;
  budget_remaining: number;
  circuit_open: boolean;
  pressure: number;
  adjusted_half_life_ms: number;
}

export interface IngestResponse {
  source: string;
  chunks: number;
  addresses: string[];
}

export interface DecayTickResponse {
  l1_examined: number;
  l1_evicted: number;
  l2_examined: number;
  l2_pruned: number;
  l2_promoted: number;
  l3_examined: number;
}

export interface DetachResponse {
  synthesized: boolean;
  traces_processed: number;
  decay: DecayTickResponse | null;
}

export interface ShadowStatsResponse {
  total_entries: number;
  active_entries: number;
  total_triggers: number;
  /** [category Debug name (e.g. "IntegrationFailure"), entry count]. */
  by_category: [string, number][];
}

/** Matches commands_v2::parse_pinning_event on the Rust side. */
export const PINNING_EVENTS = [
  "access",
  "crossref",
  "corroboration",
  "crypto",
] as const;
export type PinningEvent = (typeof PINNING_EVENTS)[number];

export const encodeMemory = (content: string, tags: string[]) =>
  invoke<EncodeResponse>("encode_memory", { content, tags });

export const queryMemory = (content: string) =>
  invoke<QueryResponse>("query_memory", { content });

export const getStats = () => invoke<StatsResponse>("get_stats");

export const checkSafety = (intent: string) =>
  invoke<SafetyResponse>("check_safety", { intent });

export const healthCheck = () => invoke<boolean>("health_check");

export const saveState = (path: string) =>
  invoke<void>("save_state", { path });

export const loadState = (path: string) =>
  invoke<void>("load_state", { path });

export const feedback = (address: string, event: PinningEvent) =>
  invoke<FeedbackResponse>("feedback", { address, event });

export const dispute = (address: string, severity: number) =>
  invoke<number | null>("dispute", { address, severity });

export const approveCrystallization = (address: string) =>
  invoke<boolean>("approve_crystallization", { address });

export const forgetMemory = (address: string) =>
  invoke<boolean>("forget_memory", { address });

export const getProfile = () => invoke<ProfileResponse>("get_profile");

export const getSloReport = () => invoke<SloResponse>("get_slo_report");

export const getRelated = (address: string) =>
  invoke<string[]>("get_related", { address });

export const getPending = () => invoke<string[]>("get_pending");

export const ingestFile = (path: string) =>
  invoke<IngestResponse>("ingest_file", { path });

export const runDecayTick = () => invoke<DecayTickResponse>("run_decay_tick");

export const detach = () => invoke<DetachResponse>("detach");

export const getShadowStats = () =>
  invoke<ShadowStatsResponse>("get_shadow_stats");
