import { useState } from "react";
import { tierAt, type ChatConfig } from "@/lib/api";

/** Matches the dot colours in Header's TONE map. */
const TONE_HEX: Record<string, string> = {
  green: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
};

function toneHex(tone: string) {
  return TONE_HEX[tone] ?? TONE_HEX.red;
}

/**
 * The whole scale, cold to hot, and it stays fully lit at every setting. That
 * is the difference between a gauge and a meter: a meter fills up from the
 * left and reads as "how many bars do I have", which is the phone-reception
 * look this deliberately avoids. Here the range is constant and only the
 * needle moves across it.
 */
const SCALE = `linear-gradient(to right, ${TONE_HEX.green} 0%, ${TONE_HEX.amber} 50%, ${TONE_HEX.red} 100%)`;

/**
 * Where a level sits on the track, 0-100. Position is by index rather than by
 * level number, so a config shipping four tiers - or levels that do not start
 * at 1 - still spreads evenly end to end.
 */
function gaugePercent(config: ChatConfig, level: number): number {
  const tiers = config.tiers ?? [];
  if (tiers.length <= 1) return 0;
  const target = tierAt(config, level).level;
  const i = tiers.findIndex((t) => t.level === target);
  return ((i === -1 ? 0 : i) / (tiers.length - 1)) * 100;
}

/** The needle. Light core over a dark casing so it stays visible on every
 *  part of the scale, green through red. */
function Needle({ pct, size }: { pct: number; size: "sm" | "lg" }) {
  return (
    <span
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white transition-all duration-300"
      style={{
        left: `${pct}%`,
        width: size === "lg" ? 3 : 2,
        height: size === "lg" ? 16 : 10,
        boxShadow: "0 0 0 1.5px hsl(240 8% 5% / 0.85), 0 1px 3px hsl(240 8% 5% / 0.6)",
      }}
      aria-hidden
    />
  );
}

/**
 * The read-out that lives in the header pill. Same instrument as the panel
 * below, shrunk - so opening the dropdown feels like leaning in rather than
 * switching to a different control.
 */
export function MiniGauge({ config, level }: { config: ChatConfig; level: number }) {
  return (
    <span className="relative h-1.5 w-10 shrink-0 rounded-full" aria-hidden>
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: SCALE, opacity: 0.9 }}
      />
      <Needle pct={gaugePercent(config, level)} size="sm" />
    </span>
  );
}

interface Props {
  config: ChatConfig;
  level: number;
  onChange: (level: number) => void;
  disabled?: boolean;
}

/**
 * The capability gauge, cold to hot.
 *
 * The interface names exactly one assistant, so the ticks are labelled by
 * level and the engine behind each one stays hidden. Clicking the gauge body
 * reveals those engine names on the ticks - opt-in, not the default read-out,
 * because what gets picked here is a capability and not a model id.
 *
 * Click routing: the tick buttons select a level and stop the event; every
 * other part of the gauge toggles the reveal. One gesture each, without a
 * second control competing for space.
 */
export function CapabilityGauge({ config, level, onChange, disabled }: Props) {
  const [revealed, setRevealed] = useState(false);

  const tiers = config.tiers ?? [];
  const current = tierAt(config, level);
  const pct = gaugePercent(config, level);

  // models.json carries the marketing name alongside the id. Falling back to
  // the raw id keeps the reveal honest when a tier points at something the
  // table does not describe.
  const engineName = (id: string) =>
    config.models?.find((m) => m.id === id)?.name ?? id;

  if (tiers.length === 0) return null;

  return (
    <div
      className="select-none px-3.5 py-3"
      onClick={() => setRevealed((v) => !v)}
      title={revealed ? "Hide engines" : "Reveal engines"}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Capability
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          {revealed ? "engines" : "tap to reveal"}
        </span>
      </div>

      {/* The scale. Fully lit at every setting - only the needle moves. */}
      <div className="relative mx-1.5 h-4">
        <div
          className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full"
          style={{ background: SCALE }}
        />
        <Needle pct={pct} size="lg" />
      </div>

      {/* Ticks sit below the scale rather than on it, so selecting a level
          never means clicking through the needle. */}
      <div className="relative mx-1.5 mt-1.5 h-9">
        {tiers.map((t, i) => {
          const at = (i / Math.max(tiers.length - 1, 1)) * 100;
          const selected = t.level === current.level;
          const hex = toneHex(t.tone);
          // The end labels would overhang the panel once they grow from "1"
          // to "Haiku 4.5", so the outer two anchor to their edges.
          const anchor =
            i === 0
              ? "translateX(0)"
              : i === tiers.length - 1
                ? "translateX(-100%)"
                : "translateX(-50%)";
          return (
            <button
              key={t.level}
              type="button"
              disabled={disabled}
              aria-label={`Level ${t.level}. ${t.hint}`}
              aria-current={selected}
              onClick={(e) => {
                // Selecting a level must not also flip the reveal.
                e.stopPropagation();
                onChange(t.level);
              }}
              className="group absolute top-0 flex flex-col items-center gap-1 disabled:opacity-50"
              style={{ left: `${at}%`, transform: anchor }}
            >
              <span
                className="w-px rounded-full transition-all"
                style={{
                  height: selected ? 8 : 5,
                  backgroundColor: selected ? hex : "hsl(var(--foreground)/0.3)",
                }}
              />
              <span
                className={`whitespace-nowrap text-[10px] leading-none transition-colors ${
                  selected
                    ? "font-semibold"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
                style={selected ? { color: hex } : undefined}
              >
                {revealed ? engineName(t.model) : t.level}
              </span>
            </button>
          );
        })}
      </div>

      <p className="border-t border-border pt-2.5 text-[11px] leading-snug text-muted-foreground">
        {current.hint}
      </p>
    </div>
  );
}
