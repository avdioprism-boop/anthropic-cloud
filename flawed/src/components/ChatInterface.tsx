import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  DEFAULT_TIER,
  FALLBACK_CONFIG,
  callClaude,
  fetchConfig,
  levelOfModel,
  readPaths,
  tierAt,
  tierLabel,
  type ChatConfig,
} from "@/lib/api";
import {
  deriveTitle,
  uid,
  useConversations,
  type ChatMessage,
} from "@/lib/conversations";
import { filesFromDrop, readFiles, type Attachment } from "@/lib/attachments";
import { useSkills } from "@/lib/skills";
import { IS_ELECTRON, useAppearance } from "@/lib/theme";
import { AttachmentBar, DropOverlay } from "./AttachmentBar";
import { Composer } from "./Composer";
import { Header } from "./Header";
import { Message, ThinkingBubble } from "./Message";
import { SettingsPanel } from "./SettingsPanel";
import { Sidebar } from "./Sidebar";
import { SkillsPanel } from "./SkillsPanel";

/**
 * The frameless Electron window overlays the native minimise/maximise/close
 * buttons on the top right, so the header has to keep clear of them. In a
 * plain browser tab there is nothing to avoid.
 */
const TITLEBAR_HEIGHT = IS_ELECTRON ? 8 : 0;
const WINDOW_CONTROLS_WIDTH = IS_ELECTRON ? 138 : 0;

/**
 * A single line that is nothing but a filesystem path: "C:\dir\file.php",
 * a UNC share, or a POSIX/~ path. Surrounding quotes are allowed because
 * Windows "Copy as path" adds them.
 */
const PATH_LINE =
  /^\s*["'<]?\s*([a-zA-Z]:[\\/][^"'<>\n]+|\\\\[^"'<>\n]+|~?\/[^"'<>\n]+)\s*["'>]?\s*$/;

/**
 * Paths in a pasted block, but only when *every* non-empty line is one.
 * Prose that happens to mention a file should stay as text - the all-or-
 * nothing rule is what keeps "look at C:\x\y.php and tell me why" from
 * being silently eaten and turned into an attachment.
 */
function pathsInText(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const hits = lines
    .map((l) => l.match(PATH_LINE)?.[1]?.trim())
    .filter((p): p is string => Boolean(p));
  return hits.length === lines.length ? hits : [];
}

const SUGGESTIONS = [
  {
    title: "Explain this code",
    body: "Drop a file in and ask what it actually does.",
    prompt: "Walk me through what this code does, and flag anything that looks wrong.",
  },
  {
    title: "Debug an error",
    body: "Paste a stack trace and get a diagnosis.",
    prompt: "Here's an error I'm hitting. What's causing it and how do I fix it?\n\n",
  },
  {
    title: "Sharpen some writing",
    body: "Cut it down to what earns its place.",
    prompt: "Tighten this without losing my voice:\n\n",
  },
  {
    title: "Plan an approach",
    body: "Think through a build before writing any of it.",
    prompt: "I want to build ",
  },
];

function EmptyState({
  modelName,
  skillCount,
  wallpaper,
  onPick,
}: {
  modelName: string;
  skillCount: number;
  wallpaper: boolean;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-16">
      {wallpaper && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="animate-aurora absolute left-1/2 top-1/4 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-[hsl(var(--brand)/0.16)] blur-[100px]" />
          <div className="animate-aurora absolute left-1/3 top-1/2 h-56 w-[28rem] rounded-full bg-[hsl(var(--brand-2)/0.12)] blur-[100px] [animation-delay:-6s]" />
        </div>
      )}

      <div className="relative z-10 w-full max-w-2xl text-center">
        <h2 className="font-display text-4xl font-bold tracking-tight">
          <span className="brand-text animate-sheen">FLAWED</span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Talking to <span className="text-foreground">{modelName}</span>
          {skillCount > 0 && (
            <>
              {" · "}
              <span className="inline-flex items-center gap-1 text-brand">
                <Sparkles className="h-3 w-3" />
                {skillCount} skill{skillCount === 1 ? "" : "s"} active
              </span>
            </>
          )}
        </p>

        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => onPick(s.prompt)}
              className="rounded-xl border border-border bg-surface/70 p-3.5 text-left transition-all hover:border-brand/40 hover:bg-surface-2"
            >
              <span className="block text-sm font-medium">{s.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {s.body}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground/70">
          Drag files anywhere to attach them, or paste them into the message box.
        </p>
      </div>
    </div>
  );
}

export function ChatInterface() {
  const { appearance, update: updateAppearance, reset: resetAppearance } =
    useAppearance();
  const skills = useSkills();

  const [config, setConfig] = useState<ChatConfig>(FALLBACK_CONFIG);
  const [reasoningOn, setReasoningOn] = useState(
    FALLBACK_CONFIG.reasoningEnabledByDefault
  );

  const conv = useConversations(FALLBACK_CONFIG.defaultModel);

  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  // Resolving pasted paths is a round trip to the server, so it needs its own
  // busy flag - the composer stays usable while files are being read.
  const [pathBusy, setPathBusy] = useState(0);
  const [pathError, setPathError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // dragenter/dragleave fire for every child element crossed, so a boolean
  // flickers as the cursor moves. Count enters against leaves instead.
  const dragDepth = useRef(0);

  const messages = useMemo(() => conv.active?.messages ?? [], [conv.active]);

  // The conversation still stores a model id, so old saved chats keep working
  // and nothing needs migrating. The UI only ever deals in levels: the id is
  // read back into one here, and written out again on change.
  const model = conv.active?.model ?? config.defaultModel;
  const level =
    levelOfModel(config, model) ?? config.defaultTier ?? DEFAULT_TIER;
  const tier = tierAt(config, level);

  function setLevel(next: number) {
    if (!conv.active) return;
    conv.update(conv.active.id, { model: tierAt(config, next).model });
  }

  useEffect(() => {
    void fetchConfig().then((loaded) => {
      setConfig(loaded);
      setReasoningOn(loaded.reasoningEnabledByDefault);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "k") {
        e.preventDefault();
        setSkillsOpen((v) => !v);
      } else if (e.key === ",") {
        e.preventDefault();
        setSettingsOpen((v) => !v);
      } else if (e.key === "b") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      } else if (e.key === "n") {
        e.preventDefault();
        conv.create(model);
        setInput("");
        setPending([]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [conv, model]);

  // ── Attachments ───────────────────────────────────────────────────
  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const read = await readFiles(files);
    setPending((prev) => {
      // Re-dropping the same file replaces the old copy rather than stacking
      // a second identical blob into the prompt.
      const byName = new Map(prev.map((a) => [a.name, a]));
      for (const a of read) byName.set(a.name, a);
      return Array.from(byName.values());
    });
  }, []);

  /**
   * Turn pasted paths into attachments. The renderer cannot open a file it
   * was only told the name of, so the local server does the reading and hands
   * back the same shape a dragged file produces.
   */
  const addPaths = useCallback(async (paths: string[]) => {
    setPathBusy(paths.length);
    setPathError(null);
    try {
      const results = await readPaths(paths);

      const ok = results.filter((r) => !r.error);
      const bad = results.filter((r) => r.error);

      if (ok.length > 0) {
        setPending((prev) => {
          const byName = new Map(prev.map((a) => [a.name, a]));
          for (const r of ok) {
            const name = r.name ?? r.path;
            byName.set(name, {
              // Keyed on the path so re-pasting the same file replaces it
              // instead of stacking a second copy into the prompt.
              id: `path:${r.path}`,
              name,
              size: r.size ?? 0,
              kind: r.kind ?? "text",
              content: r.content ?? "",
              note: r.note,
            } satisfies Attachment);
          }
          return Array.from(byName.values());
        });
      }

      // A bad path in a batch of twenty should not throw away the nineteen
      // that read fine, so report and continue rather than failing the lot.
      if (bad.length > 0) {
        setPathError(
          `${bad.length} of ${results.length} could not be read — ` +
            bad.map((b) => `${b.name ?? b.path} (${b.error})`).join(", ")
        );
      }
    } catch (error) {
      setPathError(
        error instanceof Error ? error.message : "Could not read those paths"
      );
    } finally {
      setPathBusy(0);
    }
  }, []);

  function handleDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    // Without preventDefault the browser treats this as a navigation and
    // opens the dropped file instead of firing onDrop.
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void addFiles(filesFromDrop(e.nativeEvent));
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (files.length > 0) {
      e.preventDefault();
      void addFiles(files);
      return;
    }

    // Windows "Copy as path" puts text on the clipboard, not a file, so a
    // pasted path arrives here as a string. Resolve it rather than dropping
    // a wall of C:\... into the message body.
    const paths = pathsInText(e.clipboardData?.getData("text") ?? "");
    if (paths.length > 0) {
      e.preventDefault();
      void addPaths(paths);
    }
  }

  // ── Sending ───────────────────────────────────────────────────────
  const send = useCallback(
    async (history: ChatMessage[], conversationId: string) => {
      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const reply = await callClaude(history, {
          model,
          reasoning: reasoningOn,
          skills: skills.active,
          signal: controller.signal,
          effort: tier.effort,
        });

        // The server silently retries an unreachable level on the fallback and
        // returns a perfectly normal-looking answer. Without this the reply is
        // indistinguishable from one the requested level produced, which is
        // exactly how you end up believing a level works when it does not.
        let fallbackNote: string | null = null;
        if (reply.fallbackFrom) {
          const asked = levelOfModel(config, reply.fallbackFrom);
          const served = reply.model ? levelOfModel(config, reply.model) : null;
          fallbackNote =
            `Asked for ${asked ? tierLabel(config, asked) : reply.fallbackFrom}, ` +
            `answered by ${served ? tierLabel(config, served) : reply.model}.`;
        }

        conv.update(conversationId, (c) => ({
          messages: [
            ...c.messages,
            {
              id: uid(),
              role: "assistant",
              content: reply.text,
              reasoning: reply.reasoning,
              skills: skills.active,
              fallbackNote,
              createdAt: Date.now(),
            },
          ],
        }));
      } catch (error) {
        // An abort is the user pressing Stop, not a failure worth logging in
        // the thread as an error bubble.
        if (error instanceof DOMException && error.name === "AbortError") return;
        conv.update(conversationId, (c) => ({
          messages: [
            ...c.messages,
            {
              id: uid(),
              role: "assistant",
              content:
                error instanceof Error ? error.message : "Unknown error occurred",
              error: true,
              createdAt: Date.now(),
            },
          ],
        }));
      } finally {
        abortRef.current = null;
        setLoading(false);
      }
    },
    [conv, config, model, tier.effort, reasoningOn, skills.active]
  );

  async function handleSend() {
    // A message with only files and no text is legitimate — "here, look at this".
    if (!input.trim() && pending.length === 0) return;
    if (loading || !conv.active) return;

    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: input.trim() || "(see attached files)",
      attachments: pending.length > 0 ? pending : undefined,
      skills: skills.active,
      createdAt: Date.now(),
    };

    const history = [...messages, userMessage];
    const conversationId = conv.active.id;

    conv.update(conversationId, (c) => ({
      messages: [...c.messages, userMessage],
      // Name the chat off its opening line, but never overwrite a manual rename.
      title:
        c.messages.length === 0 || c.title === "New chat"
          ? deriveTitle([userMessage])
          : c.title,
    }));

    setInput("");
    setPending([]);
    await send(history, conversationId);
  }

  /** Drop the last assistant turn and ask again from the same history. */
  function handleRetry() {
    if (loading || !conv.active) return;
    const lastUser = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUser === -1) return;
    const cutoff = messages.length - lastUser;
    const history = messages.slice(0, cutoff);
    const conversationId = conv.active.id;
    conv.update(conversationId, { messages: history });
    void send(history, conversationId);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  const canSend = !loading && (input.trim().length > 0 || pending.length > 0);
  const assistantLabel = tierLabel(config, level);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-background"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DropOverlay active={dragging} />

      <Sidebar
        open={sidebarOpen}
        conversations={conv.conversations}
        activeId={conv.activeId}
        activeSkillCount={skills.active.length}
        onSelect={(id) => {
          conv.setActiveId(id);
          setInput("");
          setPending([]);
        }}
        onCreate={() => {
          conv.create(model);
          setInput("");
          setPending([]);
        }}
        onRename={conv.rename}
        onDelete={conv.remove}
        onOpenSkills={() => setSkillsOpen(true)}
        topInset={TITLEBAR_HEIGHT}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          config={config}
          level={level}
          onLevelChange={setLevel}
          reasoning={reasoningOn}
          onReasoningChange={setReasoningOn}
          busy={loading}
          messages={messages}
          activeSkillCount={skills.active.length}
          onOpenSkills={() => setSkillsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          title={conv.active?.title ?? ""}
          controlsInset={WINDOW_CONTROLS_WIDTH}
          topInset={TITLEBAR_HEIGHT}
        />

        <main className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState
              modelName={assistantLabel}
              skillCount={skills.active.length}
              wallpaper={appearance.wallpaper}
              onPick={setInput}
            />
          ) : (
            <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
              {messages.map((msg, i) => (
                <Message
                  key={msg.id}
                  message={msg}
                  appearance={appearance}
                  skillNames={(msg.skills ?? [])
                    .map(
                      (slug) => skills.skills.find((s) => s.slug === slug)?.name
                    )
                    .filter((n): n is string => Boolean(n))}
                  onRetry={
                    // Only the last assistant turn is retryable — regenerating
                    // mid-thread would orphan everything after it.
                    msg.role === "assistant" && i === messages.length - 1
                      ? handleRetry
                      : undefined
                  }
                />
              ))}
              {loading && <ThinkingBubble showAvatar={appearance.showAvatars} />}
              <div ref={bottomRef} className="h-1" />
            </div>
          )}
        </main>

        {(pathBusy > 0 || pathError) && (
          <div className="shrink-0 px-4 pb-2">
            <div className="mx-auto w-full max-w-3xl">
              {pathBusy > 0 && (
                <p className="text-xs text-muted-foreground">
                  Reading {pathBusy} file{pathBusy === 1 ? "" : "s"} from disk…
                </p>
              )}
              {pathError && (
                <p className="flex items-start gap-2 text-xs text-amber-400">
                  <span>{pathError}</span>
                  <button
                    type="button"
                    onClick={() => setPathError(null)}
                    className="shrink-0 underline underline-offset-2 hover:text-foreground"
                  >
                    dismiss
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        <AttachmentBar
          attachments={pending}
          onRemove={(id) => setPending((prev) => prev.filter((a) => a.id !== id))}
          onClear={() => setPending([])}
        />

        <Composer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          onPickFiles={(files) => void addFiles(files)}
          onPaste={handlePaste}
          loading={loading}
          canSend={canSend}
          hasPending={pending.length > 0}
          skills={skills.skills}
          activeSkills={skills.active}
          onToggleSkill={skills.toggle}
          onManageSkills={() => setSkillsOpen(true)}
        />
      </div>

      <SkillsPanel
        open={skillsOpen}
        onClose={() => setSkillsOpen(false)}
        skills={skills.skills}
        active={skills.active}
        loading={skills.loading}
        error={skills.error}
        onToggle={skills.toggle}
        onRefresh={skills.refresh}
      />

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        appearance={appearance}
        onAppearanceChange={updateAppearance}
        onAppearanceReset={resetAppearance}
      />
    </div>
  );
}
