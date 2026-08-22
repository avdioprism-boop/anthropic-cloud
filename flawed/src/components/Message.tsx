import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  Brain,
  ChevronRight,
  FileText,
  Sparkles,
} from "lucide-react";
import { formatBytes, type Attachment } from "@/lib/attachments";
import type { ChatMessage } from "@/lib/conversations";
import type { Appearance } from "@/lib/theme";
import { Markdown } from "./Markdown";
import { MessageActions } from "./MessageActions";

function ReasoningPanel({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border/70 bg-[hsl(var(--foreground)/0.03)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <Brain className="h-3.5 w-3.5 text-brand" />
        <span className="font-medium">Reasoning</span>
        <ChevronRight
          className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-border/70 px-3 py-2.5 text-xs">
          <div className="text-muted-foreground">
            <Markdown>{reasoning}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}

/** Files carried by an already-sent message, as compact read-only tags. */
function SentAttachments({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-2.5 flex flex-wrap gap-1.5">
      {attachments.map((a) => (
        <span
          key={a.id}
          title={`${a.name} · ${formatBytes(a.size)}${a.note ? ` · ${a.note}` : ""}`}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${
            a.kind === "binary"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-border bg-[hsl(var(--foreground)/0.05)]"
          }`}
        >
          {a.kind === "binary" ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          <span className="max-w-[12rem] truncate">{a.name}</span>
        </span>
      ))}
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  return (
    <div
      className={`mt-0.5 flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg text-xs font-semibold ${
        role === "user"
          ? "border border-border bg-[hsl(var(--foreground)/0.07)] text-muted-foreground"
          : "brand-gradient text-[hsl(var(--brand-foreground))] shadow-glow"
      }`}
      aria-hidden
    >
      {role === "user" ? "OP" : "F"}
    </div>
  );
}

export function Message({
  message,
  appearance,
  skillNames,
  onRetry,
}: {
  message: ChatMessage;
  appearance: Appearance;
  skillNames: string[];
  onRetry?: () => void;
}) {
  const isUser = message.role === "user";
  const bubbles = appearance.bubbles === "bubbles";

  const shell = message.error
    ? "border border-destructive/40 bg-destructive/10"
    : isUser
      ? bubbles
        ? "border border-border bg-surface-2"
        : ""
      : bubbles
        ? "border border-border bg-surface"
        : "";

  return (
    <div
      className={`group flex w-full gap-3 animate-fade-up ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {appearance.showAvatars && <Avatar role={message.role} />}

      <div className={`flex min-w-0 max-w-[min(46rem,86%)] flex-col ${isUser ? "items-end" : "items-start"}`}>
        {skillNames.length > 0 && !isUser && (
          <div className="mb-1.5 flex flex-wrap items-center gap-1">
            <Sparkles className="h-3 w-3 text-brand" />
            {skillNames.map((name) => (
              <span
                key={name}
                className="rounded-full border border-brand/35 bg-[hsl(var(--brand)/0.1)] px-2 py-0.5 text-[10px] font-medium text-brand"
              >
                {name}
              </span>
            ))}
          </div>
        )}

        <div
          className={`w-full overflow-hidden rounded-xl px-4 py-3 ${shell} ${
            bubbles ? "shadow-raised" : "px-0"
          }`}
        >
          {message.attachments && message.attachments.length > 0 && (
            <SentAttachments attachments={message.attachments} />
          )}
          {message.fallbackNote && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              <ArrowDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{message.fallbackNote}</span>
            </div>
          )}

          {message.reasoning && <ReasoningPanel reasoning={message.reasoning} />}

          {message.error ? (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="whitespace-pre-wrap">{message.content}</span>
            </div>
          ) : (
            <Markdown>{message.content}</Markdown>
          )}
        </div>

        <div className={isUser ? "self-end pr-1" : "pl-1"}>
          <MessageActions
            content={message.content}
            role={message.role}
            onRetry={onRetry}
          />
        </div>
      </div>
    </div>
  );
}

/** Placeholder shown while the CLI call is in flight. */
export function ThinkingBubble({ showAvatar }: { showAvatar: boolean }) {
  return (
    <div className="flex gap-3 animate-fade-up">
      {showAvatar && <Avatar role="assistant" />}
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 shadow-raised">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-brand animate-thinking-dot"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </span>
        <span className="text-sm text-muted-foreground">Thinking…</span>
      </div>
    </div>
  );
}
