import { useState } from "react";
import { Check, Copy, Download, FileDown, RefreshCw } from "lucide-react";
import {
  copyToClipboard,
  download,
  downloadCodeBlock,
  extractCodeBlocks,
} from "@/lib/export";

/**
 * Per-message actions: copy the text, save it, save any fenced code blocks as
 * real files, and re-run the last exchange. Hidden until hover so they do not
 * clutter the thread.
 */
export function MessageActions({
  content,
  role,
  onRetry,
}: {
  content: string;
  role: "user" | "assistant";
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const blocks = extractCodeBlocks(content);

  async function handleCopy() {
    if (await copyToClipboard(content)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const btn =
    "flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-[hsl(var(--foreground)/0.08)] hover:text-foreground";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      <button type="button" onClick={handleCopy} className={btn}>
        {copied ? (
          <>
            <Check className="h-3 w-3" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" /> Copy
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() =>
          download(
            `message-${role === "user" ? "you" : "claude"}.md`,
            content,
            "text/markdown;charset=utf-8"
          )
        }
        className={btn}
      >
        <FileDown className="h-3 w-3" /> Save .md
      </button>

      {onRetry && (
        <button type="button" onClick={onRetry} className={btn} title="Ask again">
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      )}

      {blocks.map((block, i) => (
        <button
          key={i}
          type="button"
          onClick={() => downloadCodeBlock(block, i)}
          className={btn}
          title={`Save code block ${i + 1} (${block.lang})`}
        >
          <Download className="h-3 w-3" />
          {block.lang || "code"}
          {blocks.length > 1 ? ` ${i + 1}` : ""}
        </button>
      ))}
    </div>
  );
}
