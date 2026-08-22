import type { Attachment } from "./attachments";
// Same file the server reads. Importing it here means the offline fallback and
// the served list are the same data by construction, not by remembering to
// edit two places.
import CATALOGUE from "../../shared/models.json";

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

export interface ClaudeReply {
  text: string;
  reasoning: string | null;
  /** Set when the requested model was unreachable and another one answered. */
  fallbackFrom?: string | null;
  model?: string;
}

/** Whether the installed CLI could actually reach this model, as probed. */
export type ModelStatus = "ready" | "credits" | "no-access";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ModelOption {
  id: string;
  name: string;
  tier?: string;
  blurb?: string;
  context?: number | null;
  price?: { in: number; out: number } | null;
  status?: ModelStatus;
  note?: string;
}

/**
 * A capability level as the Operator sees it: a number, a colour, and a
 * sentence about when to use it. The model id and effort flag behind it are
 * resolution detail and are never rendered anywhere in the interface, which
 * has exactly one assistant - turned up or down.
 */
export interface Tier {
  level: number;
  model: string;
  effort: Effort;
  hint: string;
  tone: "green" | "amber" | "red";
}

export interface ChatConfig {
  models: ModelOption[];
  defaultModel: string;
  reasoningEnabledByDefault: boolean;
  effortLevels?: Effort[];
  defaultEffort?: Effort;
  fallbackModel?: string;
  tiers: Tier[];
  defaultTier: number;
  identity: { name: string; showModelIds: boolean };
}

// Used until /api/config responds, and as a fallback if it cannot be reached.
export const FALLBACK_CONFIG: ChatConfig = {
  models: CATALOGUE.models as ModelOption[],
  defaultModel: CATALOGUE.defaultModel,
  reasoningEnabledByDefault: true,
  effortLevels: CATALOGUE.effortLevels as Effort[],
  defaultEffort: CATALOGUE.defaultEffort as Effort,
  fallbackModel: CATALOGUE.fallbackModel,
  tiers: CATALOGUE.tiers as Tier[],
  defaultTier: CATALOGUE.defaultTier,
  identity: CATALOGUE.identity,
};

export const ASSISTANT_NAME = FALLBACK_CONFIG.identity.name;

/** "1000000" reads as noise in a dropdown; "1M" does not. */
export function formatContext(tokens: number | null | undefined): string {
  if (!tokens) return "";
  return tokens >= 1_000_000
    ? `${tokens / 1_000_000}M context`
    : `${Math.round(tokens / 1000)}K context`;
}

export function formatPrice(price: ModelOption["price"]): string {
  if (!price) return "";
  return `${price.in}/${price.out} per MTok`;
}

export const DEFAULT_MODEL = FALLBACK_CONFIG.defaultModel;
export const DEFAULT_TIER = FALLBACK_CONFIG.defaultTier;

/* ── Tier resolution ────────────────────────────────────────────────
   Everything below converts between the level the Operator picked and the
   (model, effort) pair the CLI needs. None of it leaks upward into rendered
   output: callers ask for a level and get behaviour.
   ------------------------------------------------------------------ */

function tiersOf(config: ChatConfig): Tier[] {
  return config.tiers?.length ? config.tiers : FALLBACK_CONFIG.tiers;
}

export function tierAt(config: ChatConfig, level: number): Tier {
  const tiers = tiersOf(config);
  // Clamp rather than throw. A level persisted by an older build, or a config
  // that shipped a different number of tiers, should degrade to the nearest
  // real one instead of taking the conversation down with it.
  const exact = tiers.find((t) => t.level === level);
  if (exact) return exact;
  const clamped = Math.min(Math.max(level, 1), tiers.length);
  return tiers[clamped - 1] ?? tiers[tiers.length - 1];
}

/** Which level a model id belongs to, or null if it is not one of the three. */
export function levelOfModel(config: ChatConfig, model: string): number | null {
  return tiersOf(config).find((t) => t.model === model)?.level ?? null;
}

/** Label for the header pill. One name, one number - never a model id. */
export function tierLabel(config: ChatConfig, level: number): string {
  return `${config.identity?.name ?? ASSISTANT_NAME} ${tierAt(config, level).level}`;
}

export async function fetchConfig(): Promise<ChatConfig> {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) throw new Error(`Config request failed: ${response.status}`);
    const loaded = await response.json();
    // An older server build answers without tiers. Fill them from the bundled
    // catalogue so the picker still renders instead of collapsing to empty.
    return {
      ...loaded,
      tiers: loaded.tiers?.length ? loaded.tiers : FALLBACK_CONFIG.tiers,
      defaultTier: loaded.defaultTier ?? FALLBACK_CONFIG.defaultTier,
      identity: loaded.identity ?? FALLBACK_CONFIG.identity,
    } as ChatConfig;
  } catch (error) {
    console.error("Falling back to built-in config:", error);
    return FALLBACK_CONFIG;
  }
}

/* ── Reading files by path ──────────────────────────────────────────
   The renderer runs with nodeIntegration off, so it cannot open a path
   itself. The server can, and it is already local-only, so pasting a path
   into the composer routes through here instead of making the Operator find
   the same file a second time in a picker.
   ------------------------------------------------------------------ */

export interface PathReadResult {
  path: string;
  name?: string;
  size?: number;
  content?: string;
  kind?: "text" | "binary";
  note?: string;
  error?: string;
}

export async function readPaths(paths: string[]): Promise<PathReadResult[]> {
  const response = await fetch("/api/read-path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths }),
  });
  if (!response.ok) {
    const detail = await response
      .json()
      .then((d: { error?: string }) => d.error)
      .catch(() => null);
    throw new Error(detail || `Could not read paths (${response.status})`);
  }
  const data = await response.json();
  return (data.files ?? []) as PathReadResult[];
}

export interface CallOptions {
  model?: string;
  reasoning?: boolean;
  /** Slugs of the skills switched on for this send. */
  skills?: string[];
  /** Lets the composer stop button abort an in-flight request. */
  signal?: AbortSignal;
  /** Maps to the CLI --effort flag. Omitted values leave the flag off. */
  effort?: Effort;
}

export async function callClaude(
  messages: Message[],
  options: CallOptions = {}
): Promise<ClaudeReply> {
  const {
    model = DEFAULT_MODEL,
    reasoning = true,
    skills = [],
    signal,
    effort,
  } = options;

  const response = await fetch("/api/claude", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model,
      // Binary attachments are stripped here rather than in the UI, so their
      // chips still show what was dropped while the payload stays text-only.
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: (m.attachments ?? [])
          .filter((a) => a.kind === "text")
          .map((a) => ({ name: a.name, content: a.content })),
      })),
      reasoning,
      skills,
      effort,
    }),
  });

  if (!response.ok) {
    // The server puts the real reason in the body; surfacing only the status
    // code turned every failure into an unhelpful "API Error 500".
    const detail = await response
      .json()
      .then((d: { error?: string }) => d.error)
      .catch(() => null);
    throw new Error(detail || `Request failed (${response.status})`);
  }

  const data = await response.json();
  return {
    text: data.content || "",
    reasoning: data.reasoning ?? null,
    fallbackFrom: data.fallbackFrom ?? null,
    model: data.model,
  };
}
