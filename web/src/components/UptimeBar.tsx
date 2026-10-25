import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getSeries } from "@/api";
import { dateTime } from "@/lib/format";
import { useTicks } from "@/lib/useTicks";

// UptimeBar shows a check's last day as slices, each the share of runs that
// passed: green when all did, amber when some failed, red when most did,
// grey when nothing ran. The share over the day stands beside it, unless
// bare. Slices are blocks of the same width.
export function UptimeBar({ checkID, slices = 48, hours = 24, bare = false, fill = false }: { checkID: number; slices?: number; hours?: number; bare?: boolean; fill?: boolean }) {
  const [to] = useState(() => Math.floor(Date.now() / 1000));
  const series = useQuery({
    queryKey: ["uptime", checkID, slices, hours],
    queryFn: () => getSeries("checks", checkID, { from: to - hours * 3600, to }, slices),
    refetchInterval: 5 * 60_000,
  });
  const step = (hours * 3600) / slices;
  const shares = new Array<number | null>(slices).fill(null);
  const ok = series.data?.columns.ok ?? [];
  (series.data?.time ?? []).forEach((ts, i) => {
    const slot = Math.floor((ts - (to - hours * 3600)) / step);
    if (slot >= 0 && slot < slices && ok[i] != null) shares[slot] = ok[i];
  });
  return <Slices shares={shares} from={to - hours * 3600} step={step} bare={bare} fill={fill} />;
}

// HostDay is a server's last day as the same slices: green where its agent
// reported, red where it was silent after it first called in, grey before.
export function HostDay({ hostID, firstSeen, slices = 48, hours = 24, bare = false, fill = false }: { hostID: number; firstSeen: number; slices?: number; hours?: number; bare?: boolean; fill?: boolean }) {
  const [to] = useState(() => Math.floor(Date.now() / 1000));
  const series = useQuery({
    queryKey: ["hostday", hostID, slices, hours],
    queryFn: () => getSeries("hosts", hostID, { from: to - hours * 3600, to }, slices),
    refetchInterval: 5 * 60_000,
  });
  const from = to - hours * 3600;
  const step = (hours * 3600) / slices;
  const reported = new Array<boolean>(slices).fill(false);
  const cpu = series.data?.columns.cpu ?? [];
  (series.data?.time ?? []).forEach((ts, i) => {
    const slot = Math.floor((ts - from) / step);
    if (slot >= 0 && slot < slices && cpu[i] != null) reported[slot] = true;
  });
  const shares = reported.map((r, i) => (r ? 1 : series.data && from + (i + 1) * step > firstSeen ? 0 : null));
  return <Slices shares={shares} from={from} step={step} bare={bare} fill={fill} />;
}

// Slices are blocks of the same whole width, or, to fill a page's width
// with few of them (fill), blocks that share it.
function Slices({ shares, from, step, bare, fill }: { shares: (number | null)[]; from: number; step: number; bare: boolean; fill: boolean }) {
  const { t } = useTranslation();
  const [ticksRef, evenBox, evenTick] = useTicks(shares.length);
  const box = fill ? { gap: 2 } : evenBox;
  const tick = fill ? { flex: "1 1 0" } : evenTick;
  const ran = shares.filter((v): v is number => v != null);
  const total = ran.length ? (100 * ran.reduce((a, b) => a + b, 0)) / ran.length : null;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div ref={ticksRef} className="flex h-5 min-w-0 flex-1 items-stretch" style={box} aria-label={t("check.uptime")}>
        {shares.map((v, i) => (
          <span
            key={i}
            className="rounded-[1.5px] transition-opacity hover:opacity-50"
            style={{ background: v == null ? "var(--muted)" : v >= 0.999 ? "var(--ok-soft)" : v >= 0.5 ? "var(--warn)" : "var(--crit)", ...tick }}
            title={`${dateTime(from + i * step)}: ${v == null ? t("uptime.noData") : `${(v * 100).toFixed(v >= 0.999 ? 0 : 1)} %`}`}
          />
        ))}
      </div>
      {!bare && (
        <span className="w-16 text-right text-mini whitespace-nowrap tabular-nums text-muted-foreground">
          {total == null ? "–" : `${total >= 99.995 || total <= 0.005 ? total.toFixed(0) : total.toFixed(2)} %`}
        </span>
      )}
    </div>
  );
}
