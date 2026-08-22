import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    /** Injected by electron-preload.cjs. Absent in a plain browser tab. */
    flawed?: {
      setTitleBarColors(color: string, symbolColor: string): void;
    };
  }
}

/**
 * Appearance state. Everything here is client-side and persisted to
 * localStorage — it never round-trips through the server, so switching a theme
 * is instant and survives a reload without a config write.
 */

export interface ThemeDef {
  id: string;
  name: string;
  blurb: string;
  scheme: "dark" | "light";
  /** Swatch preview: [background, surface, brand] as raw CSS colours. */
  swatch: [string, string, string];
  /**
   * [background, symbol] as hex, for the native window-control overlay in the
   * Electron shell. Windows will not take an hsl() string, and the buttons are
   * painted by the OS rather than by CSS, so these have to be duplicated here.
   */
  titleBar: [string, string];
}

export const THEMES: ThemeDef[] = [
  {
    id: "flawed",
    name: "Flawed",
    blurb: "Crimson on ink",
    scheme: "dark",
    swatch: ["hsl(240 8% 5%)", "hsl(240 7% 11%)", "hsl(350 82% 55%)"],
    titleBar: ["#0c0c0e", "#f4f4f6"],
  },
  {
    id: "obsidian",
    name: "Obsidian",
    blurb: "Graphite, violet spark",
    scheme: "dark",
    swatch: ["hsl(240 6% 7%)", "hsl(240 5% 13%)", "hsl(258 90% 66%)"],
    titleBar: ["#111113", "#f5f5f5"],
  },
  {
    id: "clay",
    name: "Clay",
    blurb: "Warm sand, terracotta",
    scheme: "dark",
    swatch: ["hsl(25 12% 8%)", "hsl(24 9% 14%)", "hsl(18 76% 57%)"],
    titleBar: ["#171412", "#f4f0ec"],
  },
  {
    id: "nord",
    name: "Nord",
    blurb: "Cold arctic blue",
    scheme: "dark",
    swatch: ["hsl(220 17% 13%)", "hsl(220 16% 21%)", "hsl(193 43% 67%)"],
    titleBar: ["#1c1f27", "#e5e9f0"],
  },
  {
    id: "rose",
    name: "Rosé",
    blurb: "Muted plum and rose",
    scheme: "dark",
    swatch: ["hsl(249 22% 12%)", "hsl(248 21% 19%)", "hsl(2 55% 78%)"],
    titleBar: ["#1a1825", "#deddf4"],
  },
  {
    id: "matrix",
    name: "Matrix",
    blurb: "Terminal green, true black",
    scheme: "dark",
    swatch: ["hsl(150 20% 3%)", "hsl(150 14% 9%)", "hsl(145 80% 45%)"],
    titleBar: ["#060908", "#d7eadd"],
  },
  {
    id: "paper",
    name: "Paper",
    blurb: "Warm light",
    scheme: "light",
    swatch: ["hsl(40 30% 97%)", "hsl(40 20% 94%)", "hsl(18 72% 50%)"],
    titleBar: ["#faf8f5", "#2b231d"],
  },
  {
    id: "daylight",
    name: "Daylight",
    blurb: "Cool light",
    scheme: "light",
    swatch: ["hsl(220 30% 98%)", "hsl(220 24% 95%)", "hsl(221 83% 55%)"],
    titleBar: ["#f8f9fb", "#121a2b"],
  },
];

export interface FontDef {
  id: string;
  name: string;
  stack: string;
  sample: string;
}

export const UI_FONTS: FontDef[] = [
  {
    id: "inter",
    name: "Inter",
    stack: '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
    sample: "Clean, neutral, made for screens",
  },
  {
    id: "grotesk",
    name: "Space Grotesk",
    stack: '"Space Grotesk Variable", "Inter Variable", ui-sans-serif, sans-serif',
    sample: "Geometric with character",
  },
  {
    id: "mono",
    name: "JetBrains Mono",
    stack: '"JetBrains Mono Variable", ui-monospace, monospace',
    sample: "Everything monospaced",
  },
  {
    id: "system",
    name: "System",
    stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    sample: "Whatever your OS ships",
  },
];

export const MONO_FONTS: FontDef[] = [
  {
    id: "jetbrains",
    name: "JetBrains Mono",
    stack: '"JetBrains Mono Variable", ui-monospace, monospace',
    sample: "const x = () => 42;",
  },
  {
    id: "system-mono",
    name: "System Mono",
    stack: 'ui-monospace, "Cascadia Code", Consolas, monospace',
    sample: "const x = () => 42;",
  },
];

export const DENSITIES = [
  { id: "compact", name: "Compact", scale: 0.9 },
  { id: "cozy", name: "Cozy", scale: 1 },
  { id: "roomy", name: "Roomy", scale: 1.1 },
] as const;

export type BubbleStyle = "bubbles" | "flat";

export interface Appearance {
  theme: string;
  uiFont: string;
  monoFont: string;
  density: string;
  bubbles: BubbleStyle;
  showAvatars: boolean;
  wallpaper: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "flawed",
  uiFont: "inter",
  monoFont: "jetbrains",
  density: "cozy",
  bubbles: "bubbles",
  showAvatars: true,
  wallpaper: true,
};

const STORAGE_KEY = "flawed.appearance";

function readStored(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    // Merge over defaults so a settings file written by an older build (missing
    // keys added since) still loads instead of rendering an undefined theme.
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Push appearance onto the document. Called on mount and on every change. */
function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  const theme = THEMES.find((t) => t.id === a.theme) ?? THEMES[0];
  const ui = UI_FONTS.find((f) => f.id === a.uiFont) ?? UI_FONTS[0];
  const mono = MONO_FONTS.find((f) => f.id === a.monoFont) ?? MONO_FONTS[0];
  const density = DENSITIES.find((d) => d.id === a.density) ?? DENSITIES[1];

  root.setAttribute("data-theme", theme.id);
  root.style.setProperty("--font-ui", ui.stack);
  root.style.setProperty("--font-mono", mono.stack);
  root.style.setProperty("--ui-scale", String(density.scale));

  // Windows paints the caption buttons itself, so CSS cannot reach them.
  // Optional-chained because the bridge only exists in the Electron shell.
  window.flawed?.setTitleBarColors(theme.titleBar[0], theme.titleBar[1]);
}

export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);

  // Read once on mount rather than in useState's initialiser: the initialiser
  // also runs during SSR/prerender where localStorage does not exist.
  useEffect(() => {
    const stored = readStored();
    setAppearance(stored);
    applyAppearance(stored);
  }, []);

  const update = useCallback((patch: Partial<Appearance>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...patch };
      applyAppearance(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode / quota — appearance just won't persist */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    applyAppearance(DEFAULT_APPEARANCE);
    setAppearance(DEFAULT_APPEARANCE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { appearance, update, reset };
}

/** True when running inside the Electron shell rather than a browser tab. */
export const IS_ELECTRON = /electron/i.test(
  typeof navigator === "undefined" ? "" : navigator.userAgent
);
