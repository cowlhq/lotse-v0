import { useTranslation } from "react-i18next";
import type { Level } from "@/lib/status";
import { levelColor } from "@/lib/status";

// StatusIcon says how something stands by color alone: a dot, green for
// OK, amber for WARN, red for CRIT, grey for UNKNOWN (decision 0026). Its
// word is in its title. From 18 px on, as next to a page's name, a halo in
// its color breathes around it, slowly, and not at all for those who ask
// for less motion.
export function StatusIcon({ level, size = 14, className = "" }: { level: Level; size?: number; className?: string }) {
  const { t } = useTranslation();
  const c = levelColor[level];
  const dot = Math.max(7, Math.round(size * 0.55));
  const big = size >= 18;
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }} title={t(`alert.state.${level}`)}>
      {big && <span className="status-halo absolute rounded-full" style={{ width: dot, height: dot, background: c }} />}
      <span className="relative rounded-full" style={{ width: dot, height: dot, background: c }} />
    </span>
  );
}

// Dot is a status icon in a line of text.
export function Dot({ level, className = "" }: { level: Level; className?: string }) {
  return <StatusIcon level={level} className={className} />;
}
