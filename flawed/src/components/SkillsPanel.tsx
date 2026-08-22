import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  BLANK_SKILL,
  SKILL_ICONS,
  deleteSkill,
  saveSkill,
  skillTokens,
  type Skill,
  type SkillDraft,
} from "@/lib/skills";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  skills: Skill[];
  active: string[];
  loading: boolean;
  error: string | null;
  onToggle: (slug: string) => void;
  onRefresh: () => void;
}

/** Toggle switch. A checkbox underneath keeps it keyboard- and label-friendly. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
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
  );
}

function SkillRow({
  skill,
  isActive,
  onToggle,
  onEdit,
  onDelete,
}: {
  skill: Skill;
  isActive: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        isActive
          ? "border-brand/50 bg-[hsl(var(--brand)/0.07)]"
          : "border-border bg-surface hover:border-border hover:bg-surface-2"
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg ${
          isActive
            ? "brand-gradient text-[hsl(var(--brand-foreground))]"
            : "bg-[hsl(var(--foreground)/0.06)]"
        }`}
        aria-hidden
      >
        {skill.icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate font-medium">{skill.name}</h4>
          <span className="shrink-0 rounded bg-[hsl(var(--foreground)/0.06)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ~{skillTokens(skill).toLocaleString()} tok
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
          {skill.description || "No description."}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${skill.name}`}
          className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-[hsl(var(--foreground)/0.08)] hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${skill.name}`}
          className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <Toggle
          checked={isActive}
          onChange={onToggle}
          label={`${isActive ? "Disable" : "Enable"} ${skill.name}`}
        />
      </div>
    </div>
  );
}

function SkillEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
}: {
  draft: SkillDraft;
  onChange: (patch: Partial<SkillDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const isNew = !draft.slug;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="font-display text-base font-semibold">
          {isNew ? "New skill" : "Edit skill"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-[hsl(var(--foreground)/0.08)] hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Name
          </label>
          <input
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Code Reviewer"
            autoFocus
            className="w-full rounded-md border border-border bg-[hsl(var(--foreground)/0.04)] px-3 py-2 text-sm outline-none transition-colors focus:border-brand/60"
          />
          {isNew && draft.name && (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              saves to skills/
              {draft.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "") || "…"}
              /SKILL.md
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Description
          </label>
          <input
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="One line on what this skill makes Flawed do."
            className="w-full rounded-md border border-border bg-[hsl(var(--foreground)/0.04)] px-3 py-2 text-sm outline-none transition-colors focus:border-brand/60"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Icon
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => onChange({ icon })}
                className={`flex h-9 w-9 items-center justify-center rounded-md border text-base transition-colors ${
                  draft.icon === icon
                    ? "border-brand bg-[hsl(var(--brand)/0.15)]"
                    : "border-border hover:bg-[hsl(var(--foreground)/0.06)]"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Instructions
          </label>
          <textarea
            value={draft.body}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder={
              "Markdown. These lines are spliced into the system prompt whenever\nthe skill is switched on.\n\n- Be specific about what to do\n- Say what NOT to do too"
            }
            spellCheck={false}
            className="h-64 w-full resize-y rounded-md border border-border bg-[hsl(var(--foreground)/0.04)] px-3 py-2 font-mono text-[13px] leading-relaxed outline-none transition-colors focus:border-brand/60"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            ~{Math.ceil(draft.body.length / 4).toLocaleString()} tokens · sent
            with every message while active
          </p>
        </div>
      </div>

      {error && (
        <div className="mx-5 mb-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-[hsl(var(--foreground)/0.06)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !draft.name.trim()}
          className="flex items-center gap-1.5 rounded-md brand-gradient px-3.5 py-1.5 text-sm font-medium text-[hsl(var(--brand-foreground))] transition-opacity disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Save skill
        </button>
      </div>
    </div>
  );
}

export function SkillsPanel({
  open,
  onClose,
  skills,
  active,
  loading,
  error,
  onToggle,
  onRefresh,
}: Props) {
  const [draft, setDraft] = useState<SkillDraft | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Reopening should always land on the list, never on a half-finished edit.
  useEffect(() => {
    if (!open) {
      setDraft(null);
      setQuery("");
      setSaveError(null);
      setConfirmDelete(null);
    }
  }, [open]);

  const filtered = skills.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  });

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveSkill(draft);
      onRefresh();
      setDraft(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(slug: string) {
    try {
      await deleteSkill(slug);
      // A skill that is on when deleted would otherwise stay in the active set.
      if (active.includes(slug)) onToggle(slug);
      onRefresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-3xl">
      {draft ? (
        <SkillEditor
          draft={draft}
          onChange={(patch) => setDraft({ ...draft, ...patch })}
          onSave={handleSave}
          onCancel={() => {
            setDraft(null);
            setSaveError(null);
          }}
          saving={saving}
          error={saveError}
        />
      ) : (
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Skills</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Reusable instruction sets. Switch one on and it rides along in
                  the system prompt for every message.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-[hsl(var(--foreground)/0.08)] hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search skills…"
                  className="w-full rounded-md border border-border bg-[hsl(var(--foreground)/0.04)] py-1.5 pl-8 pr-3 text-sm outline-none transition-colors focus:border-brand/60"
                />
              </div>
              <button
                type="button"
                onClick={onRefresh}
                title="Re-read skills from disk"
                className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-[hsl(var(--foreground)/0.06)] hover:text-foreground"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...BLANK_SKILL })}
                className="flex items-center gap-1.5 rounded-md brand-gradient px-3 py-1.5 text-sm font-medium text-[hsl(var(--brand-foreground))]"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="py-14 text-center">
                <p className="text-sm text-muted-foreground">
                  {query
                    ? `Nothing matches "${query}".`
                    : "No skills yet. Create one and it becomes a folder on disk."}
                </p>
              </div>
            )}

            {filtered.map((skill) =>
              confirmDelete === skill.slug ? (
                <div
                  key={skill.slug}
                  className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
                >
                  <span>
                    Delete <strong>{skill.name}</strong>? This removes
                    skills/{skill.slug}/ from disk.
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-[hsl(var(--foreground)/0.06)]"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(skill.slug)}
                      className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <SkillRow
                  key={skill.slug}
                  skill={skill}
                  isActive={active.includes(skill.slug)}
                  onToggle={() => onToggle(skill.slug)}
                  onEdit={() =>
                    setDraft({
                      slug: skill.slug,
                      name: skill.name,
                      description: skill.description,
                      icon: skill.icon,
                      body: skill.body,
                    })
                  }
                  onDelete={() => setConfirmDelete(skill.slug)}
                />
              )
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>
              {active.length} of {skills.length} active
            </span>
            <span className="font-mono">skills/&lt;slug&gt;/SKILL.md</span>
          </div>
        </div>
      )}
    </Modal>
  );
}
