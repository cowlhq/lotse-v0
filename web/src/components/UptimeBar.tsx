import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getSeries } from "@/api";
import { dateTime } from "@/lib/format";
import { useTicks } from "@/lib/useTicks";

// UptimeBar shows a check's last day as slices, each the share of runs that
// passed: green when all did, amber when some failed, red when most did,
// grey when nothing ran. The share over the day stands beside it. Slices
// are blocks of the same width.
export function UptimeBar({ checkID, slices = 48, hours = 24 }: { checkID: number; slices?: number; hours?: number }) {
  const { t } = useTranslation();
  const [ticksRef, box, tick] = useTicks(slices);
  const [to] = useState(() => Math.floor(Date.now() / 1000));
  const series = useQuery({
    queryKey: ["uptime", checkID, slices, hours],
    queryFn: () => getSeries("checks", checkID, { from: to - hours * 3600, to }, slices),
    refetchInterval: 5 * 60_000,
  });
  const step = (hours * 3600) / slices;
  const shares = new Array<number | null>(slices).fill(null);
  const time = series.data?.time ?? [];
  const ok = series.data?.columns.ok ?? [];
  time.forEach((ts, i) => {
    const slot = Math.floor((ts - (to - hours * 3600)) / step);
    if (slot >= 0 && slot < slices && ok[i] != null) shares[slot] = ok[i];
  });
  const ran = shares.filter((v): v is number => v != null);
  const total = ran.length ? (100 * ran.reduce((a, b) => a + b, 0)) / ran.length : null;
  return (
    <div className="flex items-center gap-3">
      <div ref={ticksRef} className="flex h-5 min-w-0 flex-1 items-stretch" style={box} aria-label={t("check.uptime")}>
        {shares.map((v, i) => {
          const color = v == null ? "var(--muted)" : v >= 0.999 ? "var(--ok)" : v >= 0.5 ? "var(--warn)" : "var(--crit)";
          const at = to - hours * 3600 + i * step;
          return (
            <span
              key={i}
              className="rounded-[1.5px] transition-opacity hover:opacity-50"
              style={{ background: color, ...tick }}
              title={`${dateTime(at)}: ${v == null ? t("uptime.noData") : `${(v * 100).toFixed(v >= 0.999 ? 0 : 1)} %`}`}
            />
          );
        })}
      </div>
      <span className="w-16 text-right text-mini whitespace-nowrap tabular-nums text-muted-foreground">{total == null ? "–" : `${total >= 99.995 || total <= 0.005 ? total.toFixed(0) : total.toFixed(2)} %`}</span>
    </div>
  );
}
