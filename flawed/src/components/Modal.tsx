import { useEffect, type ReactNode } from "react";

/**
 * Centred dialog with a scrim. Deliberately not Radix Dialog: the panels here
 * need to own their own scrolling regions and header/footer bars, and the
 * primitive's portal + focus trap bought nothing that mattered for a
 * single-window desktop app.
 */
export function Modal({
  open,
  onClose,
  children,
  className = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-[hsl(var(--popover))] shadow-panel animate-pop-in ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
