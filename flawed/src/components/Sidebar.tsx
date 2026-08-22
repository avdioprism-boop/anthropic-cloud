import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { relativeTime, type Conversation } from "@/lib/conversations";

interface Props {
  open: boolean;
  conversations: Conversation[];
  activeId: string | null;
  activeSkillCount: number;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onOpenSkills: () => void;
  topInset: number;
}

function Row({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft !== conversation.title) onRename(draft);
    else setDraft(conversation.title);
  }

  if (editing) {
    return (
      <input
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(conversation.title);
            setEditing(false);
          }
        }}
        className="w-full rounded-md border border-brand/60 bg-[hsl(var(--foreground)/0.06)] px-2.5 py-2 text-sm outline-none"
      />
    );
  }

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
        isActive
          ? "bg-[hsl(var(--brand)/0.14)] text-foreground"
          : "text-muted-foreground hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <MessageSquare
          className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-brand" : "opacity-60"}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{conversation.title}</span>
          <span className="block truncate text-[11px] opacity-60">
            {conversation.messages.length} msg ·{" "}
            {relativeTime(conversation.updatedAt)}
          </span>
        </span>
      </button>

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Chat options"
          className={`rounded p-1 transition-opacity hover:bg-[hsl(var(--foreground)/0.1)] ${
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-md border border-border bg-[hsl(var(--popover))] shadow-panel animate-pop-in">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setEditing(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[hsl(var(--foreground)/0.06)]"
            >
              <Pencil className="h-3 w-3" /> Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  open,
  conversations,
  activeId,
  activeSkillCount,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onOpenSkills,
  topInset,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = conversations.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  });

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200 ${
        open ? "w-64" : "w-0"
      }`}
      aria-hidden={!open}
    >
      {/* Matches the title-bar inset so the rail lines up with the header. */}
      <div className="drag-region shrink-0" style={{ height: topInset }} />

      <div className="w-64 shrink-0 space-y-2 px-3 pb-2">
        <button
          type="button"
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-2 rounded-lg brand-gradient px-3 py-2 text-sm font-medium text-[hsl(var(--brand-foreground))] transition-transform active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="w-full rounded-md border border-border bg-[hsl(var(--foreground)/0.04)] py-1.5 pl-8 pr-2.5 text-sm outline-none transition-colors focus:border-brand/60"
          />
        </div>
      </div>

      <div className="w-64 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No chats match “{query}”.
          </p>
        )}
        {filtered.map((c) => (
          <Row
            key={c.id}
            conversation={c}
            isActive={c.id === activeId}
            onSelect={() => onSelect(c.id)}
            onRename={(title) => onRename(c.id, title)}
            onDelete={() => onDelete(c.id)}
          />
        ))}
      </div>

      <div className="w-64 shrink-0 border-t border-border p-2">
        <button
          type="button"
          onClick={onOpenSkills}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground"
        >
          <Sparkles className="h-4 w-4" />
          <span className="flex-1 text-left">Skills</span>
          {activeSkillCount > 0 && (
            <span className="rounded-full brand-gradient px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--brand-foreground))]">
              {activeSkillCount}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
