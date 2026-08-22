import { AlertTriangle, FileText, Paperclip, X } from "lucide-react";
import {
  estimateTokens,
  formatBytes,
  totalTokens,
  type Attachment,
} from "@/lib/attachments";

/**
 * Full-window overlay shown while a drag is in progress. pointer-events-none
 * matters: without it the overlay becomes the drop target and swallows the
 * drop event before the handler on the container below can see it.
 */
export function DropOverlay({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="rounded-xl border-2 border-dashed border-brand bg-[hsl(var(--popover))] px-12 py-9 text-center shadow-panel">
        <Paperclip className="mx-auto mb-3 h-8 w-8 text-brand" />
        <p className="font-display text-lg font-semibold">Drop files to attach</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Text and code files. Binary files are listed but not sent.
        </p>
      </div>
    </div>
  );
}

function Chip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: (id: string) => void;
}) {
  const isBinary = attachment.kind === "binary";
  const tokens = isBinary ? 0 : estimateTokens(attachment.content);

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
        isBinary
          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
          : "border-border bg-surface-2"
      }`}
      title={
        isBinary
          ? `${attachment.name} — binary file, will not be sent`
          : `${attachment.name} — ${formatBytes(attachment.size)}, ~${tokens.toLocaleString()} tokens`
      }
    >
      {isBinary ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-brand" />
      )}
      <span className="max-w-[16rem] truncate font-medium">{attachment.name}</span>
      <span className="shrink-0 text-muted-foreground">
        {isBinary ? "not sent" : `~${tokens.toLocaleString()} tok`}
      </span>
      {attachment.note && (
        <span className="shrink-0 text-amber-400">· {attachment.note}</span>
      )}
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        aria-label={`Remove ${attachment.name}`}
        className="ml-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-[hsl(var(--foreground)/0.1)] hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function AttachmentBar({
  attachments,
  onRemove,
  onClear,
}: {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (attachments.length === 0) return null;

  const tokens = totalTokens(attachments);
  const binaryCount = attachments.filter((a) => a.kind === "binary").length;
  // The backend re-sends the whole conversation every turn, so this cost is
  // recurring rather than one-off. Warn before it gets uncomfortable.
  const heavy = tokens > 25_000;

  return (
    <div className="shrink-0 px-4">
      <div className="mx-auto w-full max-w-3xl rounded-lg border border-border bg-surface px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {attachments.length} file{attachments.length === 1 ? "" : "s"} attached
            {tokens > 0 && (
              <span className={heavy ? "text-amber-400" : ""}>
                {" "}
                · ~{tokens.toLocaleString()} tokens
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Clear all
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <Chip key={a.id} attachment={a} onRemove={onRemove} />
          ))}
        </div>

        {binaryCount > 0 && (
          <p className="mt-2 text-xs text-amber-400">
            {binaryCount} binary file{binaryCount === 1 ? "" : "s"} will not be
            sent — this chat backend is text-only.
          </p>
        )}

        {heavy && (
          <p className="mt-2 text-xs text-amber-400">
            Large attachment set. These are re-sent with every message in this
            conversation, so replies will get slower and more expensive.
          </p>
        )}
      </div>
    </div>
  );
}
