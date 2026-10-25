// Usage meters, as a host's page shows its filesystems' and its containers'.

// Bar is a share: the number, and a grey bar that turns amber and red as
// it fills; colour only where it needs a look.
export function Bar({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-muted-foreground">–</span>;
  const color = pct >= 90 ? "var(--crit)" : pct >= 75 ? "var(--warn)" : "color-mix(in oklch, var(--muted-foreground) 55%, transparent)";
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 text-right text-muted-foreground tabular-nums">{pct < 10 ? pct.toFixed(1) : Math.round(pct)}%</span>
      <span className="relative h-1 w-full min-w-12 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--foreground)_10%,transparent)]">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, Math.max(1.5, pct))}%`, background: color }} />
      </span>
    </div>
  );
}
