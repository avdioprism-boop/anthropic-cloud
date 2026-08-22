import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, Settings2, Sparkles, Square, X } from "lucide-react";
import type { Skill } from "@/lib/skills";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onPickFiles: (files: File[]) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  loading: boolean;
  canSend: boolean;
  hasPending: boolean;
  skills: Skill[];
  activeSkills: string[];
  onToggleSkill: (slug: string) => void;
  onManageSkills: () => void;
}

const MAX_ROWS_PX = 240;

/** Quick on/off list for skills, so switching one does not need the full panel. */
function SkillsPopover({
  skills,
  active,
  onToggle,
  onManage,
  onClose,
}: {
  skills: Skill[];
  active: string[];
  onToggle: (slug: string) => void;
  onManage: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-full left-0 z-30 mb-2 w-72 overflow-hidden rounded-lg border border-border bg-[hsl(var(--popover))] shadow-panel animate-pop-in">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Skills
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto p-1">
        {skills.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No skills defined yet.
          </p>
        )}
        {skills.map((skill) => {
          const on = active.includes(skill.slug);
          return (
            <button
              key={skill.slug}
              type="button"
              onClick={() => onToggle(skill.slug)}
              className={`flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors ${
                on
                  ? "bg-[hsl(var(--brand)/0.12)]"
                  : "hover:bg-[hsl(var(--foreground)/0.05)]"
              }`}
            >
              <span className="mt-0.5 text-base leading-none" aria-hidden>
                {skill.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {skill.name}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {skill.description}
                </span>
              </span>
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  on ? "bg-brand" : "bg-[hsl(var(--foreground)/0.15)]"
                }`}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onManage}
        className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground"
      >
        <Settings2 className="h-3 w-3" />
        Manage skills
      </button>
    </div>
  );
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  onPickFiles,
  onPaste,
  loading,
  canSend,
  hasPending,
  skills,
  activeSkills,
  onToggleSkill,
  onManageSkills,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [skillsOpen, setSkillsOpen] = useState(false);

  // Grow with the content up to a ceiling, then scroll. Height has to be reset
  // to auto first or scrollHeight keeps reporting the previous, larger box and
  // the field only ever grows.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  }, [value]);

  useEffect(() => {
    if (!skillsOpen) return;
    function onDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSkillsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [skillsOpen]);

  const activeList = skills.filter((s) => activeSkills.includes(s.slug));

  return (
    <div className="shrink-0 px-4 pb-4">
      <div className="mx-auto w-full max-w-3xl">
        {activeList.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {activeList.map((skill) => (
              <button
                key={skill.slug}
                type="button"
                onClick={() => onToggleSkill(skill.slug)}
                title={`${skill.description}\n\nClick to switch off`}
                className="group/pill flex items-center gap-1.5 rounded-full border border-brand/40 bg-[hsl(var(--brand)/0.1)] py-1 pl-2.5 pr-1.5 text-xs text-brand transition-colors hover:bg-[hsl(var(--brand)/0.18)]"
              >
                <span aria-hidden>{skill.icon}</span>
                <span className="font-medium">{skill.name}</span>
                <X className="h-3 w-3 opacity-50 transition-opacity group-hover/pill:opacity-100" />
              </button>
            ))}
          </div>
        )}

        <div className="relative rounded-xl border border-border bg-surface shadow-raised transition-colors focus-within:border-brand/50">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            rows={1}
            placeholder={
              hasPending
                ? "Add a message, or send the files on their own…"
                : "Message Flawed…   ⏎ to send, ⇧⏎ for a new line"
            }
            className="block max-h-[240px] w-full resize-none bg-transparent px-4 pb-12 pt-3.5 text-[0.9375rem] leading-relaxed outline-none placeholder:text-muted-foreground/70"
          />

          <div className="absolute inset-x-2 bottom-2 flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                onPickFiles(Array.from(e.target.files ?? []));
                // Reset so picking the same file twice still fires onChange.
                e.target.value = "";
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[hsl(var(--foreground)/0.07)] hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <div ref={popoverRef} className="relative">
              <button
                type="button"
                onClick={() => setSkillsOpen((v) => !v)}
                title="Skills"
                className={`flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs transition-colors ${
                  activeSkills.length > 0
                    ? "text-brand hover:bg-[hsl(var(--brand)/0.12)]"
                    : "text-muted-foreground hover:bg-[hsl(var(--foreground)/0.07)] hover:text-foreground"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                {activeSkills.length > 0 && (
                  <span className="font-medium">{activeSkills.length}</span>
                )}
              </button>

              {skillsOpen && (
                <SkillsPopover
                  skills={skills}
                  active={activeSkills}
                  onToggle={onToggleSkill}
                  onManage={() => {
                    setSkillsOpen(false);
                    onManageSkills();
                  }}
                  onClose={() => setSkillsOpen(false)}
                />
              )}
            </div>

            <div className="flex-1" />

            {loading ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generating"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
              >
                <Square className="h-3 w-3 fill-current" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                title="Send"
                className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient text-[hsl(var(--brand-foreground))] transition-all disabled:opacity-30 disabled:saturate-0 enabled:hover:shadow-glow enabled:active:scale-95"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
