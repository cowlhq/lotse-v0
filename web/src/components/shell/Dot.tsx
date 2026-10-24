import { useTranslation } from "react-i18next";
import type { Level } from "@/lib/status";
import { levelColor } from "@/lib/status";

// StatusIcon says how something stands by color alone: a dot, green for
// OK, amber for WARN, red for CRIT, grey for UNKNOWN (decision 0026). Its
// word is in its title. From 18 px on, as next to a page's name, the dot
// has a faint halo in its color.
export function StatusIcon({ level, size = 14, className = "" }: { level: Level; size?: number; className?: string }) {
  const { t } = useTranslation();
  const c = levelColor[level];
  const dot = Math.max(7, Math.round(size * 0.55));
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }} title={t(`alert.state.${level}`)}>
      <span
        className="rounded-full"
        style={{ width: dot, height: dot, background: c, boxShadow: size >= 18 ? `0 0 0 ${Math.round(dot * 0.4)}px color-mix(in oklch, ${c} 18%, transparent)` : undefined }}
      />
    </span>
  );
}

// Dot is a status icon in a line of text.
export function Dot({ level, className = "" }: { level: Level; className?: string }) {
  return <StatusIcon level={level} className={className} />;
}
