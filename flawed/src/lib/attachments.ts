// File attachment handling for drag-and-drop.
//
// Deliberately uses the standard web File API (file.text(), file.arrayBuffer())
// rather than Electron's webUtils.getPathForFile. Two reasons: this renderer has
// nodeIntegration off so it cannot read from disk itself, and the web path also
// works if the app is opened in a plain browser via the Claude Chat.url shortcut.

export type AttachmentKind = "text" | "binary";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  kind: AttachmentKind;
  /** File text. Empty string for binary attachments, which are not sent. */
  content: string;
  /** Set when the file was accepted but altered, e.g. truncated. */
  note?: string;
}

/**
 * Per-file cap on what gets inlined into the prompt. The backend re-sends the
 * whole conversation on every turn, so an attachment is not paid for once - it
 * is paid for on every subsequent message. 256 KB is roughly 64k tokens, which
 * is already a lot to carry turn over turn.
 */
export const MAX_INLINE_BYTES = 256 * 1024;

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "rst", "log", "csv", "tsv",
  "json", "jsonl", "yaml", "yml", "toml", "ini", "cfg", "conf", "env",
  "js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts",
  "html", "htm", "css", "scss", "sass", "less", "svg", "vue", "svelte",
  "py", "rb", "go", "rs", "java", "kt", "kts", "c", "h", "cpp", "hpp", "cc",
  "cs", "php", "swift", "scala", "clj", "ex", "exs", "lua", "r", "pl", "dart",
  "sh", "bash", "zsh", "fish", "ps1", "psm1", "bat", "cmd",
  "sql", "graphql", "gql", "proto", "diff", "patch",
  "gitignore", "dockerignore", "editorconfig", "npmrc", "nvmrc",
  "dockerfile", "makefile", "gradle", "properties", "lock",
]);

export function extensionOf(name: string): string {
  const base = name.toLowerCase();
  const dot = base.lastIndexOf(".");
  // Extensionless files like "Dockerfile" or "Makefile" are matched by name.
  if (dot <= 0) return base;
  return base.slice(dot + 1);
}

function looksTextualByName(name: string): boolean {
  return TEXT_EXTENSIONS.has(extensionOf(name));
}

/**
 * Extension allowlists miss things, so confirm by sniffing. A NUL byte in the
 * first 4 KB is the classic binary tell - no text encoding this app will meet
 * produces one in normal content.
 */
async function looksTextualByContent(file: File): Promise<boolean> {
  const head = await file.slice(0, 4096).arrayBuffer();
  const bytes = new Uint8Array(head);
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return false;
  }
  return true;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Rough token estimate. ~4 characters per token is the usual English/code
 * approximation - good enough to warn someone before they blow up a prompt,
 * and explicitly not exact.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function totalTokens(attachments: Attachment[]): number {
  return attachments.reduce(
    (sum, a) => sum + (a.kind === "text" ? estimateTokens(a.content) : 0),
    0
  );
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `att-${counter}-${String(performance.now()).replace(".", "")}`;
}

export async function readFile(file: File): Promise<Attachment> {
  const base = {
    id: nextId(),
    name: file.name,
    size: file.size,
  };

  const textual =
    looksTextualByName(file.name) || (await looksTextualByContent(file));

  if (!textual) {
    return { ...base, kind: "binary", content: "" };
  }

  let content: string;
  let note: string | undefined;

  if (file.size > MAX_INLINE_BYTES) {
    content = await file.slice(0, MAX_INLINE_BYTES).text();
    note = `truncated to first ${formatBytes(MAX_INLINE_BYTES)} of ${formatBytes(file.size)}`;
  } else {
    content = await file.text();
  }

  return { ...base, kind: "text", content, note };
}

export async function readFiles(files: File[]): Promise<Attachment[]> {
  const results = await Promise.all(
    files.map(async (f) => {
      try {
        return await readFile(f);
      } catch (error) {
        console.error(`Could not read ${f.name}:`, error);
        return null;
      }
    })
  );
  return results.filter((a): a is Attachment => a !== null);
}

/**
 * Pull File objects out of a drop event. Directories are skipped rather than
 * silently contributing nothing - a dropped folder arrives as a zero-size entry
 * with no type, which would otherwise attach as an empty file.
 */
export function filesFromDrop(event: DragEvent): File[] {
  const out: File[] = [];
  const items = event.dataTransfer?.items;

  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry?.();
      if (entry && entry.isDirectory) continue;
      const file = item.getAsFile();
      if (file) out.push(file);
    }
    return out;
  }

  const list = event.dataTransfer?.files;
  if (list) {
    for (let i = 0; i < list.length; i++) out.push(list[i]);
  }
  return out;
}
