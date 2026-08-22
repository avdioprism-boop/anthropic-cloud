// Conversation export.
//
// Uses a Blob + object URL rather than a data: URI so large conversations are
// not capped by URL length limits, and revokes the URL afterwards so the blob
// is not pinned in memory for the life of the window.

import type { Attachment } from "./attachments";

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
  reasoning?: string | null;
  attachments?: Attachment[];
}

export type ExportFormat = "markdown" | "json" | "text";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local-time stamp for filenames: 2026-08-17_1432. */
function stamp(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

function attachmentSummary(attachments?: Attachment[]): string[] {
  if (!attachments || attachments.length === 0) return [];
  return attachments.map((a) =>
    a.kind === "binary"
      ? `${a.name} (binary, not sent)`
      : `${a.name}${a.note ? ` (${a.note})` : ""}`
  );
}

export function toMarkdown(
  messages: ExportMessage[],
  meta: { model: string; exportedAt: Date }
): string {
  const lines: string[] = [
    "# FLAWED transcript",
    "",
    `- Exported: ${meta.exportedAt.toLocaleString()}`,
    `- Model: ${meta.model}`,
    `- Messages: ${messages.length}`,
    "",
    "---",
    "",
  ];

  for (const msg of messages) {
    lines.push(`## ${msg.role === "user" ? "Operator" : "Flawed"}`, "");

    const files = attachmentSummary(msg.attachments);
    if (files.length > 0) {
      lines.push(`**Attached:** ${files.join(", ")}`, "");
    }

    if (msg.reasoning) {
      lines.push("<details>", "<summary>Reasoning</summary>", "");
      lines.push(msg.reasoning, "");
      lines.push("</details>", "");
    }

    lines.push(msg.content, "");
  }

  return lines.join("\n");
}

export function toJSON(
  messages: ExportMessage[],
  meta: { model: string; exportedAt: Date }
): string {
  return JSON.stringify(
    {
      exportedAt: meta.exportedAt.toISOString(),
      model: meta.model,
      messageCount: messages.length,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        reasoning: m.reasoning ?? null,
        attachments: (m.attachments ?? []).map((a) => ({
          name: a.name,
          size: a.size,
          kind: a.kind,
          note: a.note ?? null,
          // Full text is included on purpose: a JSON export is meant to be a
          // complete, reloadable record of the conversation.
          content: a.content,
        })),
      })),
    },
    null,
    2
  );
}

export function toText(messages: ExportMessage[]): string {
  return messages
    .map((msg) => {
      const who = msg.role === "user" ? "Operator" : "Flawed";
      const files = attachmentSummary(msg.attachments);
      const header = files.length > 0 ? `${who} [${files.join(", ")}]` : who;
      return `${header}:\n${msg.content}`;
    })
    .join("\n\n----------------------------------------\n\n");
}

const FORMATS: Record<
  ExportFormat,
  { ext: string; mime: string; label: string }
> = {
  markdown: { ext: "md", mime: "text/markdown;charset=utf-8", label: "Markdown" },
  json: { ext: "json", mime: "application/json;charset=utf-8", label: "JSON" },
  text: { ext: "txt", mime: "text/plain;charset=utf-8", label: "Plain text" },
};

export function formatLabel(format: ExportFormat): string {
  return FORMATS[format].label;
}

export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revocation; revoking synchronously can cancel the download in some
  // Chromium builds before it has been handed to the download manager.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function exportConversation(
  messages: ExportMessage[],
  format: ExportFormat,
  model: string
): void {
  const exportedAt = new Date();
  const meta = { model, exportedAt };

  const content =
    format === "markdown"
      ? toMarkdown(messages, meta)
      : format === "json"
        ? toJSON(messages, meta)
        : toText(messages);

  const { ext, mime } = FORMATS[format];
  download(`claude-chat_${stamp(exportedAt)}.${ext}`, content, mime);
}

/** Fenced code blocks in a message, for the per-block save buttons. */
export interface CodeBlock {
  lang: string;
  code: string;
}

export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const fence = /```([\w+-]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text)) !== null) {
    const code = match[2].replace(/\n$/, "");
    if (code.trim().length > 0) {
      blocks.push({ lang: match[1] || "txt", code });
    }
  }
  return blocks;
}

const LANG_EXT: Record<string, string> = {
  typescript: "ts", ts: "ts", tsx: "tsx",
  javascript: "js", js: "js", jsx: "jsx",
  python: "py", py: "py",
  bash: "sh", sh: "sh", shell: "sh", zsh: "sh",
  powershell: "ps1", ps1: "ps1",
  json: "json", yaml: "yml", yml: "yml", toml: "toml",
  html: "html", css: "css", scss: "scss",
  sql: "sql", go: "go", rust: "rs", rs: "rs",
  java: "java", kotlin: "kt", ruby: "rb", php: "php",
  csharp: "cs", cpp: "cpp", c: "c", swift: "swift",
  markdown: "md", md: "md", diff: "diff", patch: "diff",
};

export function downloadCodeBlock(block: CodeBlock, index: number): void {
  const ext = LANG_EXT[block.lang.toLowerCase()] || "txt";
  download(
    `snippet-${index + 1}.${ext}`,
    block.code,
    "text/plain;charset=utf-8"
  );
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context; localhost qualifies, but fall back
    // anyway so a file:// or odd-origin load still copies.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
