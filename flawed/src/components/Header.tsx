import { useEffect, useRef, useState } from "react";
import {
  Brain,
  ChevronDown,
  PanelLeft,
  PanelLeftClose,
  Settings,
  Sparkles,
} from "lucide-react";
import { tierAt, type ChatConfig } from "@/lib/api";
import { CapabilityGauge, MiniGauge } from "./CapabilityGauge";
import { ExportMenu } from "./ExportMenu";
import type { ExportMessage } from "@/lib/export";

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  config: ChatConfig;
  /** The capability level the Operator has selected: 1, 2 or 3. */
  level: number;
  onLevelChange: (level: number) => void;
  reasoning: boolean;
  onReasoningChange: (v: boolean) => void;
  busy: boolean;
  messages: ExportMessage[];
  activeSkillCount: number;
  onOpenSkills: () => void;
  onOpenSettings: () => void;
  title: string;
  /** Reserved space for the OS window controls in the frameless shell. */
  controlsInset: number;
  topInset: number;
}

/**
 * Green through amber to red, low to high. The colour is the whole signal: it
 * reads as "turned up" at a glance, without the Operator needing to know or
 * care which engine sits behind a level.
 */
const TONE: Record<string, { dot: string; text: string; ring: string }> = {
  green: {
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    ring: "border-emerald-400/40 bg-emerald-400/10",
  },
  amber: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    ring: "border-amber-400/40 bg-amber-400/10",
  },
  red: {
    dot: "bg-red-400",
    text: "text-red-400",
    ring: "border-red-400/40 bg-red-400/10",
  },
};

function toneOf(tone: string) {
  return TONE[tone] ?? TONE.red;
}

/**
 * The one control that says what the assistant is set to. It shows a name and
 * a number. The model id and effort flag behind that number are resolution
 * detail and are deliberately never rendered: there is one assistant in this
 * interface, turned up or down.
 */
function EffortPicker({
  config,
  level,
  onChange,
  disabled,
}: {
  config: ChatConfig;
  level: number;
  onChange: (level: number) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const name = config.identity?.name ?? "Flawed";
  const current = tierAt(config, level);
  const tone = toneOf(current.tone);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="no-drag relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={current.hint}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors disabled:opacity-50 ${tone.ring}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
        <span className="font-medium">{name}</span>

        {/* The scale, not a stack of bars. Ascending bars read as phone
            reception - how much signal have I got - which is the opposite of
            what this control means. */}
        <MiniGauge config={config} level={level} />

        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-80 overflow-hidden rounded-lg border border-border bg-[hsl(var(--popover))] shadow-panel animate-pop-in">
          {/* The gauge is the picker. It stays open after a change so the
              Operator can feel the notch move rather than having the panel
              vanish on the first click. */}
          <CapabilityGauge config={config} level={level} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

export function Header({
  sidebarOpen,
  onToggleSidebar,
  config,
  level,
  onLevelChange,
  reasoning,
  onReasoningChange,
  busy,
  messages,
  activeSkillCount,
  onOpenSkills,
  onOpenSettings,
  title,
  controlsInset,
  topInset,
}: Props) {
  const iconBtn =
    "no-drag flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[hsl(var(--foreground)/0.07)] hover:text-foreground";

  const name = config.identity?.name ?? "Flawed";

  return (
    <header
      className="drag-region glass z-20 flex shrink-0 items-center gap-3 border-b border-border px-3"
      style={{ paddingTop: topInset, paddingRight: controlsInset + 12 }}
    >
      <div className="flex h-14 items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className={iconBtn}
          title={sidebarOpen ? "Hide sidebar (Ctrl+B)" : "Show sidebar (Ctrl+B)"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </button>

        <span className="select-none font-display text-lg font-bold tracking-tight">
          <span className="brand-text animate-sheen">FLAWED</span>
        </span>
      </div>

      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {title}
      </span>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onReasoningChange(!reasoning)}
          disabled={busy}
          title={
            reasoning
              ? "Reasoning on — replies include a collapsible working-out panel"
              : "Reasoning off — slightly faster replies"
          }
          className={`no-drag flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors disabled:opacity-50 ${
            reasoning
              ? "border-brand/40 bg-[hsl(var(--brand)/0.12)] text-brand"
              : "border-border bg-surface text-muted-foreground hover:bg-surface-2"
          }`}
        >
          <Brain className="h-4 w-4" />
          <span className="hidden sm:inline">Reasoning</span>
        </button>

        <EffortPicker
          config={config}
          level={level}
          onChange={onLevelChange}
          disabled={busy}
        />

        <div className="no-drag">
          <ExportMenu messages={messages} model={`${name} ${level}`} />
        </div>

        <button
          type="button"
          onClick={onOpenSkills}
          title="Skills (Ctrl+K)"
          className={`${iconBtn} relative`}
        >
          <Sparkles className="h-4 w-4" />
          {activeSkillCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full brand-gradient px-1 text-[10px] font-semibold text-[hsl(var(--brand-foreground))]">
              {activeSkillCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings (Ctrl+,)"
          className={iconBtn}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
