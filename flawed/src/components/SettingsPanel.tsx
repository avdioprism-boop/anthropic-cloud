import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Info,
  Loader2,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Type,
  X,
} from "lucide-react";
import {
  DENSITIES,
  MONO_FONTS,
  THEMES,
  UI_FONTS,
  type Appearance,
} from "@/lib/theme";
import { Modal } from "./Modal";

interface EditableConfig {
  systemPrompt: string;
  reasoningInstruction: string;
  maxTokens: number;
}

type Tab = "appearance" | "model" | "about";

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "model", label: "Model", icon: SlidersHorizontal },
  { id: "about", label: "About", icon: Info },
];

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {hint && <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-surface px-3.5 py-3 transition-colors hover:bg-surface-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[22px] w-10 shrink-0 rounded-full transition-colors ${
          checked ? "brand-gradient" : "bg-[hsl(var(--foreground)/0.15)]"
        }`}
      >
        <span
          className={`absolute left-0 top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[21px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </label>
  );
}

export function SettingsPanel({
  isOpen,
  onClose,
  appearance,
  onAppearanceChange,
  onAppearanceReset,
}: {
  isOpen: boolean;
  onClose: () => void;
  appearance: Appearance;
  onAppearanceChange: (patch: Partial<Appearance>) => void;
  onAppearanceReset: () => void;
}) {
  const [tab, setTab] = useState<Tab>("appearance");
  const [config, setConfig] = useState<EditableConfig>({
    systemPrompt: "",
    reasoningInstruction: "",
    maxTokens: 2048,
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) =>
        setConfig({
          systemPrompt: data.systemPrompt || "",
          reasoningInstruction: data.reasoningInstruction || "",
          maxTokens: data.maxTokens || 2048,
        })
      )
      .catch((err) => {
        console.error("Failed to fetch config:", err);
        setError("Could not read the config file.");
      });
  }, [isOpen]);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error("Server rejected the save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save config:", err);
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={isOpen} onClose={onClose} className="max-w-3xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="font-display text-lg font-semibold">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-[hsl(var(--foreground)/0.08)] hover:text-foreground"
          aria-label="Close settings"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Tab rail */}
        <nav className="w-44 shrink-0 space-y-1 border-r border-border p-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                tab === id
                  ? "bg-[hsl(var(--brand)/0.14)] font-medium text-foreground"
                  : "text-muted-foreground hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
          {tab === "appearance" && (
            <>
              <Section
                title="Theme"
                hint="Palettes are swapped wholesale — nothing in the app hard-codes a colour."
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => onAppearanceChange({ theme: theme.id })}
                      className={`group flex flex-col gap-2 rounded-lg border p-2.5 text-left transition-all ${
                        appearance.theme === theme.id
                          ? "border-brand ring-1 ring-brand/40"
                          : "border-border hover:border-[hsl(var(--foreground)/0.25)]"
                      }`}
                    >
                      <span
                        className="flex h-11 items-end gap-1 rounded-md p-1.5"
                        style={{ background: theme.swatch[0] }}
                      >
                        <span
                          className="h-4 flex-1 rounded-sm"
                          style={{ background: theme.swatch[1] }}
                        />
                        <span
                          className="h-6 w-6 rounded-full"
                          style={{ background: theme.swatch[2] }}
                        />
                      </span>
                      <span>
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {theme.name}
                          {appearance.theme === theme.id && (
                            <Check className="h-3 w-3 text-brand" />
                          )}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {theme.blurb}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Interface font">
                <div className="grid gap-2 sm:grid-cols-2">
                  {UI_FONTS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => onAppearanceChange({ uiFont: font.id })}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        appearance.uiFont === font.id
                          ? "border-brand bg-[hsl(var(--brand)/0.08)]"
                          : "border-border hover:bg-[hsl(var(--foreground)/0.04)]"
                      }`}
                      style={{ fontFamily: font.stack }}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Type className="h-3.5 w-3.5 opacity-60" />
                        {font.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {font.sample}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Code font">
                <div className="grid gap-2 sm:grid-cols-2">
                  {MONO_FONTS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => onAppearanceChange({ monoFont: font.id })}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        appearance.monoFont === font.id
                          ? "border-brand bg-[hsl(var(--brand)/0.08)]"
                          : "border-border hover:bg-[hsl(var(--foreground)/0.04)]"
                      }`}
                    >
                      <span className="text-sm font-medium">{font.name}</span>
                      <span
                        className="mt-0.5 block truncate text-xs text-muted-foreground"
                        style={{ fontFamily: font.stack }}
                      >
                        {font.sample}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Density" hint="Scales the whole interface, not just text.">
                <div className="flex gap-2">
                  {DENSITIES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onAppearanceChange({ density: d.id })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        appearance.density === d.id
                          ? "border-brand bg-[hsl(var(--brand)/0.08)] font-medium"
                          : "border-border hover:bg-[hsl(var(--foreground)/0.04)]"
                      }`}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Chat">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {(
                      [
                        ["bubbles", "Bubbles"],
                        ["flat", "Flat"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onAppearanceChange({ bubbles: id })}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          appearance.bubbles === id
                            ? "border-brand bg-[hsl(var(--brand)/0.08)] font-medium"
                            : "border-border hover:bg-[hsl(var(--foreground)/0.04)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <SwitchRow
                    label="Avatars"
                    hint="Show the speaker badge next to each message."
                    checked={appearance.showAvatars}
                    onChange={(v) => onAppearanceChange({ showAvatars: v })}
                  />
                  <SwitchRow
                    label="Ambient glow"
                    hint="Soft brand-coloured light behind the thread."
                    checked={appearance.wallpaper}
                    onChange={(v) => onAppearanceChange({ wallpaper: v })}
                  />
                </div>
              </Section>

              <button
                type="button"
                onClick={onAppearanceReset}
                className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                Reset appearance to defaults
              </button>
            </>
          )}

          {tab === "model" && (
            <>
              <Section
                title="System prompt"
                hint="Sent with every message. Active skills are appended after this."
              >
                <textarea
                  value={config.systemPrompt}
                  onChange={(e) =>
                    setConfig({ ...config, systemPrompt: e.target.value })
                  }
                  placeholder="You are a helpful assistant…"
                  className="h-32 w-full resize-y rounded-md border border-border bg-[hsl(var(--foreground)/0.04)] px-3 py-2 text-sm outline-none transition-colors focus:border-brand/60"
                />
              </Section>

              <Section
                title="Reasoning format"
                hint="Appended when the Reasoning toggle is on. The tags are what the parser looks for — keep them."
              >
                <textarea
                  value={config.reasoningInstruction}
                  onChange={(e) =>
                    setConfig({ ...config, reasoningInstruction: e.target.value })
                  }
                  spellCheck={false}
                  className="h-32 w-full resize-y rounded-md border border-border bg-[hsl(var(--foreground)/0.04)] px-3 py-2 font-mono text-[13px] outline-none transition-colors focus:border-brand/60"
                />
              </Section>

              <Section title="Max tokens" hint="Response length ceiling.">
                <input
                  type="number"
                  value={config.maxTokens}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      maxTokens: parseInt(e.target.value) || 2048,
                    })
                  }
                  className="w-40 rounded-md border border-border bg-[hsl(var(--foreground)/0.04)] px-3 py-2 text-sm outline-none focus:border-brand/60"
                />
              </Section>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                {saved && (
                  <span className="flex items-center gap-1 text-sm text-brand">
                    <Check className="h-3.5 w-3.5" /> Saved to
                    claude-chat.config.json
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-md brand-gradient px-4 py-2 text-sm font-medium text-[hsl(var(--brand-foreground))] disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save
                </button>
              </div>
            </>
          )}

          {tab === "about" && (
            <div className="space-y-5 text-sm">
              <div>
                <h3 className="font-display text-2xl font-bold">
                  <span className="brand-text animate-sheen">FLAWED</span>
                </h3>
                <p className="mt-1 text-muted-foreground">
                  A local chat front-end for the Claude CLI.
                </p>
              </div>

              <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-muted-foreground">
                <dt className="text-foreground">Backend</dt>
                <dd>
                  browser → Vite dev server → <code className="font-mono">claude</code>{" "}
                  CLI → Anthropic
                </dd>
                <dt className="text-foreground">Credentials</dt>
                <dd>None stored here. The CLI holds your login.</dd>
                <dt className="text-foreground">Skills</dt>
                <dd>
                  <code className="font-mono">skills/&lt;slug&gt;/SKILL.md</code> — same
                  format Claude Code uses
                </dd>
                <dt className="text-foreground">Config</dt>
                <dd>
                  <code className="font-mono">claude-chat.config.json</code>, re-read
                  every request
                </dd>
                <dt className="text-foreground">Appearance</dt>
                <dd>localStorage, per browser</dd>
              </dl>

              <div className="rounded-lg border border-border bg-surface p-3.5">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Shortcuts
                </h4>
                <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
                  {[
                    ["Enter", "Send"],
                    ["Shift + Enter", "New line"],
                    ["Ctrl + K", "Skills"],
                    ["Ctrl + ,", "Settings"],
                    ["Ctrl + N", "New chat"],
                    ["Ctrl + B", "Toggle sidebar"],
                    ["Esc", "Close panel / stop"],
                  ].map(([key, action]) => (
                    <div key={key} className="contents">
                      <dt className="font-mono text-muted-foreground">{key}</dt>
                      <dd>{action}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
