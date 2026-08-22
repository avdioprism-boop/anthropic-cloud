import { useCallback, useEffect, useState } from "react";

/**
 * Skills client. Definitions live on disk as skills/<slug>/SKILL.md and are
 * served by the dev server; which ones are *switched on* is a per-browser
 * preference and stays in localStorage.
 */

export interface Skill {
  slug: string;
  name: string;
  description: string;
  icon: string;
  body: string;
  updatedAt: number;
}

export interface SkillDraft {
  slug?: string;
  name: string;
  description: string;
  icon: string;
  body: string;
}

export const BLANK_SKILL: SkillDraft = {
  name: "",
  description: "",
  icon: "◆",
  body: "",
};

/** Icon choices offered in the editor. Any single character is legal. */
export const SKILL_ICONS = [
  "◆", "◈", "◎", "⌗", "✂", "⚑", "★", "✦", "⚙", "⌁",
  "🧠", "🔍", "📐", "⚗", "🎯", "📊", "🧭", "🛠", "📎", "⚡",
];

const ACTIVE_KEY = "flawed.skills.active";

function readActive(): string[] {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function writeActive(slugs: string[]) {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(slugs));
  } catch {
    /* private mode / quota — the set just won't survive a reload */
  }
}

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function listSkills(): Promise<Skill[]> {
  const res = await fetch("/api/skills");
  return (await json<{ skills: Skill[] }>(res)).skills;
}

export async function saveSkill(draft: SkillDraft): Promise<Skill> {
  const res = await fetch("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  return (await json<{ skill: Skill }>(res)).skill;
}

export async function deleteSkill(slug: string): Promise<void> {
  const res = await fetch("/api/skills/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  await json(res);
}

/** Rough cost of a skill once it is spliced into the system prompt. */
export function skillTokens(skill: Skill): number {
  return Math.ceil((skill.body.length + skill.description.length) / 4);
}

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [active, setActive] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await listSkills();
      setSkills(loaded);
      setError(null);

      // Drop any slug whose skill has since been deleted, so a stale
      // localStorage entry can't keep sending a skill that no longer exists.
      setActive((prev) => {
        const live = prev.filter((slug) => loaded.some((s) => s.slug === slug));
        if (live.length !== prev.length) writeActive(live);
        return live;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setActive(readActive());
    void refresh();
  }, [refresh]);

  const toggle = useCallback((slug: string) => {
    setActive((prev) => {
      const next = prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : [...prev, slug];
      writeActive(next);
      return next;
    });
  }, []);

  const clearActive = useCallback(() => {
    setActive([]);
    writeActive([]);
  }, []);

  return {
    skills,
    active,
    activeSkills: skills.filter((s) => active.includes(s.slug)),
    loading,
    error,
    refresh,
    toggle,
    clearActive,
  };
}
