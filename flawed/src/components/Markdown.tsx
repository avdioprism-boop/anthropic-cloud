import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/export";

/** Walk a rendered node tree and pull out its plain text, for the copy button. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  const props = (node as { props?: { children?: ReactNode } }).props;
  return props ? textOf(props.children) : "";
}

/** `language-ts` on the inner <code> is where rehype-highlight records it. */
function languageOf(node: ReactNode): string {
  const props = (node as { props?: { className?: string } })?.props;
  const match = /language-([\w-]+)/.exec(props?.className || "");
  return match ? match[1] : "";
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const lang = languageOf(Array.isArray(children) ? children[0] : children);
  const source = textOf(children);

  async function handleCopy() {
    if (await copyToClipboard(source)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <figure className="group/code relative my-4 overflow-hidden rounded-lg border border-border bg-[hsl(var(--background))]">
      <figcaption className="flex items-center justify-between border-b border-border/70 bg-[hsl(var(--foreground)/0.03)] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {lang || "text"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground opacity-0 transition-all hover:bg-[hsl(var(--foreground)/0.08)] hover:text-foreground focus-visible:opacity-100 group-hover/code:opacity-100"
          aria-label="Copy code"
        >
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
      </figcaption>
      <pre>{children}</pre>
    </figure>
  );
}

/**
 * Message body renderer. Memoised because a chat re-renders the whole thread on
 * every keystroke in the composer, and re-parsing every message each time is
 * the difference between a smooth and a stuttering input box.
 */
export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          // Links open outside the app rather than replacing the chat window.
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          table: ({ children, ...props }) => (
            <div className="my-4 overflow-x-auto">
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
