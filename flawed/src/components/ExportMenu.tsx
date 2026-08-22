import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { exportConversation, type ExportFormat } from "@/lib/export";
import type { ExportMessage } from "@/lib/export";

const OPTIONS: { format: ExportFormat; label: string; hint: string }[] = [
  { format: "markdown", label: "Markdown", hint: "Readable, keeps reasoning" },
  { format: "json", label: "JSON", hint: "Complete structured record" },
  { format: "text", label: "Plain text", hint: "Just the conversation" },
];

export function ExportMenu({
  messages,
  model,
}: {
  messages: ExportMessage[];
  model: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const disabled = messages.length === 0;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleExport(format: ExportFormat) {
    exportConversation(messages, format, model);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={disabled ? "Nothing to export yet" : "Export this conversation"}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[hsl(var(--foreground)/0.07)] hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Download className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-60 overflow-hidden rounded-lg border border-border bg-[hsl(var(--popover))] shadow-panel animate-pop-in">
          {OPTIONS.map((opt) => (
            <button
              key={opt.format}
              type="button"
              onClick={() => handleExport(opt.format)}
              className="block w-full px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--foreground)/0.06)]"
            >
              <span className="block text-sm font-medium">{opt.label}</span>
              <span className="block text-xs text-muted-foreground">
                {opt.hint}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
