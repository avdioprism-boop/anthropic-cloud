import { useCallback, useEffect, useState } from "react";
import type { Attachment } from "./attachments";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string | null;
  attachments?: Attachment[];
  /** Skill slugs that were active when this message was sent. */
  skills?: string[];
  /**
   * Set when the level the Operator asked for could not answer and a
   * different one did. Rendered on the message so a substituted reply can
   * never quietly pass for the real thing.
   */
  fallbackNote?: string | null;
  error?: boolean;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "flawed.conversations";

/** Cheap unique id. crypto.randomUUID is not available over plain http on LAN. */
export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newConversation(model: string): Conversation {
  const now = Date.now();
  return {
    id: uid(),
    title: "New chat",
    messages: [],
    model,
    createdAt: now,
    updatedAt: now,
  };
}

/** First user message, trimmed to something that fits a sidebar row. */
export function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const line = first.content.replace(/\s+/g, " ").trim();
  if (!line) return "New chat";
  return line.length > 44 ? `${line.slice(0, 44)}…` : line;
}

export function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function load(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(list: Conversation[]) {
  try {
    // Attachment bodies are the bulk of a conversation and are already inlined
    // into the messages that were sent, so they are dropped from what is
    // stored. Keeping them would blow the ~5 MB localStorage quota after a
    // handful of chats and silently lose the whole history.
    const slim = list.map((c) => ({
      ...c,
      messages: c.messages.map((m) => ({
        ...m,
        attachments: m.attachments?.map((a) => ({ ...a, content: "" })),
      })),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch (error) {
    console.warn("[conversations] Could not persist history:", error);
  }
}

/**
 * Conversation store.
 *
 * List and selection live in one state object on purpose. They were two, with
 * an `useEffect` doing the initial load and a `hydrated` ref guarding the save
 * effect — under StrictMode's double mount the save effect fired once with the
 * still-empty initial list *after* the ref had been flipped, overwriting
 * localStorage with `[]` and losing every saved chat on reload. Loading in the
 * initialiser removes the window entirely: there is never a render in which
 * state is empty but storage is not.
 */
export function useConversations(defaultModel: string) {
  const [state, setState] = useState<{
    list: Conversation[];
    activeId: string;
  }>(() => {
    const stored = load();
    const list = stored.length > 0 ? stored : [newConversation(defaultModel)];
    return { list, activeId: list[0].id };
  });

  useEffect(() => {
    persist(state.list);
  }, [state.list]);

  const { list: conversations, activeId } = state;
  const active = conversations.find((c) => c.id === activeId) ?? null;

  const setActiveId = useCallback((id: string) => {
    setState((s) => ({ ...s, activeId: id }));
  }, []);

  const update = useCallback(
    (
      id: string,
      patch: Partial<Conversation> | ((c: Conversation) => Partial<Conversation>)
    ) => {
      setState((s) => ({
        ...s,
        list: s.list
          .map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...(typeof patch === "function" ? patch(c) : patch),
                  updatedAt: Date.now(),
                }
              : c
          )
          // Most-recent first, so the chat you just touched is always on top.
          .sort((a, b) => b.updatedAt - a.updatedAt),
      }));
    },
    []
  );

  const create = useCallback((model: string) => {
    const fresh = newConversation(model);
    setState((s) => ({ list: [fresh, ...s.list], activeId: fresh.id }));
    return fresh;
  }, []);

  const remove = useCallback((id: string) => {
    setState((s) => {
      const next = s.list.filter((c) => c.id !== id);
      // Never leave the pane with nothing to show, and deleting the open chat
      // has to land somewhere — both decided here rather than in a second
      // setState, which would run during this updater and warn.
      if (next.length === 0) {
        const fresh = newConversation(
          s.list.find((c) => c.id === id)?.model ?? "claude-opus-5"
        );
        return { list: [fresh], activeId: fresh.id };
      }
      return {
        list: next,
        activeId: id === s.activeId ? next[0].id : s.activeId,
      };
    });
  }, []);

  const rename = useCallback(
    (id: string, title: string) => {
      update(id, { title: title.trim() || "Untitled" });
    },
    [update]
  );

  const clearAll = useCallback(() => {
    const fresh = newConversation(defaultModel);
    setState({ list: [fresh], activeId: fresh.id });
  }, [defaultModel]);

  return {
    conversations,
    active,
    activeId,
    setActiveId,
    create,
    update,
    remove,
    rename,
    clearAll,
  };
}
