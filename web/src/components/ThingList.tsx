import { useNavigate } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { certDays } from "@/components/CheckState";
import { StatusIcon } from "@/components/shell/Dot";
import { HostDay, UptimeBar } from "@/components/UptimeBar";
import { ago } from "@/lib/format";
import { thingPath, type Thing } from "@/lib/things";

// ThingList is what lotse watches, a line each, servers and checks alike:
// how it stands, its name, what kind it is, its last day, and one figure.
// With group, lines go under headings, such as a customer's projects.
export function ThingList({ things, group }: { things: Thing[]; group?: (t: Thing) => { key: string; label: ReactNode } }) {
  const navigate = useNavigate();
  const groups: { key: string; label: ReactNode; list: Thing[] }[] = [];
  for (const t of things) {
    const g = group?.(t) ?? { key: "", label: null };
    let at = groups.find((x) => x.key === g.key);
    if (!at) groups.push((at = { ...g, list: [] }));
    at.list.push(t);
  }
  groups.sort((a, b) => a.key.localeCompare(b.key));
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {groups.map((g, gi) => (
        <Fragment key={g.key}>
          {g.label && <div className={`px-4 pb-1 text-mini text-muted-foreground ${gi === 0 ? "pt-3" : "pt-5"}`}>{g.label}</div>}
          {g.list.map((t, i) => (
            <div
              key={t.key}
              role="link"
              tabIndex={0}
              onClick={() => navigate(thingPath(t))}
              onKeyDown={(e) => e.key === "Enter" && navigate(thingPath(t))}
              className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-accent/60 md:grid-cols-[minmax(0,1.5fr)_6.5rem_minmax(0,1.3fr)_13rem] ${i > 0 || (gi > 0 && !g.label) ? "border-t border-border/60" : ""}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <StatusIcon level={t.level} />
                <span className="truncate font-medium">{t.name}</span>
              </span>
              <Kind thing={t} className="hidden md:block" />
              <span className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
                {t.kind === "server" ? (
                  <HostDay hostID={t.id} firstSeen={t.host.host.first_seen} bare />
                ) : t.kind === "cron" ? (
                  <span className="text-mini text-muted-foreground" />
                ) : (
                  <UptimeBar checkID={t.id} bare />
                )}
              </span>
              <span className="text-right text-mini whitespace-nowrap tabular-nums text-muted-foreground">
                <Figure thing={t} />
              </span>
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

export function Kind({ thing, className = "" }: { thing: Thing; className?: string }) {
  const { t } = useTranslation();
  return <span className={`text-mini text-muted-foreground ${className}`}>{t(`thing.kind.${thing.kind}`)}</span>;
}

// Figure is the one number of a thing: a server's load, a check's answer,
// a certificate's or domain's days, a cron job's last ping.
export function Figure({ thing: x }: { thing: Thing }) {
  const { t } = useTranslation();
  if (x.kind === "server") {
    const h = x.host;
    if (h.host.waiting) return <>{t("status.waiting")}</>;
    if (!h.host.online) return <span style={{ color: h.host.agent_revoked ? undefined : "var(--crit)" }}>{h.host.agent_revoked ? t("status.revoked") : t("rows.offlineSince", { time: ago(h.host.last_seen) })}</span>;
    const mem = h.latest?.mem_used != null && h.host.mem_total > 0 ? (100 * h.latest.mem_used) / h.host.mem_total : null;
    const part = (label: string, v: number | null | undefined, warn: number, crit: number) =>
      v == null ? null : (
        <span style={v >= crit ? { color: "var(--crit)" } : v >= warn ? { color: "var(--warn)" } : undefined}>
          {label} {Math.round(v)}%
        </span>
      );
    const parts = [part(t("thing.cpu"), h.latest?.cpu, 75, 90), part(t("thing.ram"), mem, 85, 95), part(t("thing.disk"), h.disk, 85, 95)].filter(Boolean);
    return (
      <>
        {parts.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && " · "}
            {p}
          </Fragment>
        ))}
      </>
    );
  }
  const c = x.check;
  if (x.kind === "cron") return <>{c.last_ping ? t("rows.lastPing", { time: ago(c.last_ping) }) : t("rows.noPing")}</>;
  const days = certDays(c);
  if (x.kind === "certificate" || x.kind === "domain") {
    return days != null ? <span style={days < (x.kind === "domain" ? 30 : 14) ? { color: "var(--warn)" } : undefined}>{t("check.days", { count: days })}</span> : <>–</>;
  }
  return <>{c.latency_ms != null ? `${Math.round(c.latency_ms)} ms` : "–"}</>;
}
