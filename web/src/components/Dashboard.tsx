import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getConfig, getSeries, listChecks, listHosts, listScopes, type Check, type HostSummary, type Scope } from "@/api";
import { AddThing } from "@/components/AddThing";
import { useAlerts } from "@/components/Alerts";
import { certDays } from "@/components/CheckState";
import { Incidents } from "@/components/Incidents";
import { StatusIcon } from "@/components/shell/Dot";
import { ThingList } from "@/components/ThingList";
import { Skeleton } from "@/components/ui/skeleton";
import { useLive } from "@/lib/live";
import { firing, levelUnder } from "@/lib/status";
import { things } from "@/lib/things";
import { useMe } from "@/lib/useMe";

// Dashboard is home: in one sentence how everything stands, what needs
// attention, and the customers, each in a line with its last 30 days. With
// one customer only, its things instead. A new hub asks what to watch
// first (decision 0027).
export function Dashboard() {
  const { t } = useTranslation();
  const { isHubAdmin } = useMe();
  const hosts = useQuery({ queryKey: ["hosts"], queryFn: listHosts, refetchInterval: 60_000 });
  const scopes = useQuery({ queryKey: ["scopes"], queryFn: listScopes });
  const checks = useQuery({ queryKey: ["checks", "all"], queryFn: () => listChecks(), refetchInterval: 30_000 });
  const alerts = useAlerts().data ?? [];
  const client = useQueryClient();
  useLive(["hosts"], (m) => {
    if (m.type === "host") {
      client.setQueryData<HostSummary[]>(["hosts"], (list) => list?.map((h) => (h.host.id === m.host_id ? { ...h, latest: m.reading } : h)));
    } else if (m.type === "host_state") {
      client.setQueryData<HostSummary[]>(["hosts"], (list) => list?.map((h) => (h.host.id === m.host_id ? { ...h, host: { ...h.host, online: m.online! } } : h)));
    } else if (m.type !== "alerts") {
      client.invalidateQueries({ queryKey: ["hosts"] });
    }
  });
  const stats = useCheckStats(checks.data ?? []);

  if (hosts.isPending || scopes.isPending || checks.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (hosts.isError || scopes.isError || checks.isError) return <p className="text-destructive">{t("app.unreachable")}</p>;
  const list = things(hosts.data, checks.data, alerts, scopes.data);
  if (list.length === 0) return <Welcome />;

  const all = scopes.data;
  const ids = new Set(all.map((s) => s.id));
  // The top: the customers, or for a user kept to a project, that.
  const roots = all.filter((s) => s.parent_id == null || !ids.has(s.parent_id)).sort((a, b) => a.name.localeCompare(b.name));
  const problems = firing(alerts);
  const crit = problems.some((a) => a.state === "crit");
  const need = new Set(problems.map((a) => a.subject_path.split("/").slice(0, 4).join("/"))).size;
  const pathOf = new Map(all.map((s) => [s.id, s.path]));
  const under = (root: Scope) => list.filter((x) => {
    const p = x.envID ? pathOf.get(x.envID) : undefined;
    return p !== undefined && (p === root.path || p.startsWith(root.path + "/"));
  });

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
          <StatusIcon level={crit ? "crit" : problems.length ? "warn" : "ok"} size={22} />
          {problems.length ? t("thing.needYouTitle", { count: need }) : t("thing.allFine", { count: list.length })}
        </h1>
        <p className="text-muted-foreground">
          {[t("thing.forCustomers", { count: list.length, customers: roots.length }), stats.uptime && t("stats.uptimeFact", { value: stats.uptime })].filter(Boolean).join(" · ")}
        </p>
      </div>
      {isHubAdmin && <NotifyHint />}
      {problems.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium">{t("thing.attention")}</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Incidents alerts={problems} />
          </div>
        </section>
      )}
      {roots.length > 1 ? (
        <section className="space-y-3">
          <div className="flex items-baseline">
            <h2 className="flex-1 font-medium">{t(`tiles.${roots[0].kind}`)}</h2>
            <span className="text-mini text-muted-foreground">{t("tiles.last30")}</span>
          </div>
          <Customers roots={roots} under={under} checks={checks.data} />
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-baseline">
            <h2 className="flex-1 font-medium">{t("thing.everything")}</h2>
            <span className="text-mini text-muted-foreground">{t("table.last24h")}</span>
          </div>
          <ThingList things={list} />
        </section>
      )}
    </div>
  );
}

// Customers are a line each: how it stands, how many things, its checks'
// last 30 days, a slice a day, and its uptime.
function Customers({ roots, under, checks }: { roots: Scope[]; under: (s: Scope) => ReturnType<typeof things>; checks: Check[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const alerts = useAlerts().data ?? [];
  const days = useDailyUptime(checks);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {roots.map((s, i) => {
        const mine = under(s);
        const strip = combine(mine.filter((x) => x.kind !== "server").map((x) => days[x.id]));
        const ran = strip.filter((v): v is number => v != null);
        const uptime = ran.length ? percent((100 * ran.reduce((a, b) => a + b, 0)) / ran.length) : null;
        return (
          <div
            key={s.id}
            role="link"
            tabIndex={0}
            onClick={() => navigate({ to: "/scopes/$id", params: { id: String(s.id) } })}
            onKeyDown={(e) => e.key === "Enter" && navigate({ to: "/scopes/$id", params: { id: String(s.id) } })}
            className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 transition-colors hover:bg-accent/60 md:grid-cols-[minmax(0,1.4fr)_7rem_minmax(0,1.6fr)_5rem] ${i > 0 ? "border-t border-border/60" : ""}`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <StatusIcon level={levelUnder(alerts, s.path)} />
              <span className="truncate font-medium">{s.name}</span>
            </span>
            <span className="hidden text-mini text-muted-foreground md:block">{t("thing.count", { count: mine.length })}</span>
            <span className="hidden md:block">{ran.length > 0 && <Strip days={strip} />}</span>
            <span className="text-right text-mini text-muted-foreground tabular-nums">{uptime ?? "–"}</span>
          </div>
        );
      })}
    </div>
  );
}

// NotifyHint reminds whoever looks after the hub that alerts reach no one
// until a channel is switched on.
function NotifyHint() {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ["config", "global:1"], queryFn: () => getConfig("global:1") });
  const routed = (config.data?.find((v) => v.key === "notify.channels")?.value as string[] | undefined) ?? [];
  if (config.isPending || routed.length > 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed px-4 py-3 text-muted-foreground">
      <span>{t("overview.notifyNowhere")}</span>
      <Link to="/settings" search={{ tab: "notifications" }} className="font-medium text-brand hover:underline">
        {t("start.notify.action")}
      </Link>
    </div>
  );
}

// Strip is the 30 days of a tile, filling its width; a tile has no room
// to leave over, as a table's column has.
function Strip({ days }: { days: (number | null)[] }) {
  return (
    <div className="flex h-5 gap-[2px]">
      {days.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1.5px]"
          style={{ background: v == null ? "var(--muted)" : v >= 0.999 ? "var(--ok-soft)" : v >= 0.5 ? "var(--warn)" : "var(--crit)" }}
        />
      ))}
    </div>
  );
}

// useDailyUptime is each check's share of passed runs per day, the last 30
// days, oldest first; null for a day without runs.
function useDailyUptime(checks: Check[]): Record<number, (number | null)[]> {
  const [to] = useState(() => Math.floor(Date.now() / 1000 / 86400) * 86400 + 86400);
  const from = to - 30 * 86400;
  const results = useQueries({
    queries: checks
      .filter((c) => c.type !== "heartbeat")
      .map((c) => ({
        queryKey: ["uptime30", c.id, to],
        queryFn: () => getSeries("checks", c.id, { from, to }, 30),
        staleTime: 10 * 60_000,
        select: (s: Awaited<ReturnType<typeof getSeries>>) => {
          const out = new Array<number | null>(30).fill(null);
          const ok = s.columns.ok ?? [];
          s.time.forEach((ts, i) => {
            const day = Math.floor((ts - from) / 86400);
            if (day >= 0 && day < 30 && ok[i] != null) out[day] = ok[i];
          });
          return { id: c.id, days: out };
        },
      })),
  });
  const out: Record<number, (number | null)[]> = {};
  for (const r of results) if (r.data) out[r.data.id] = r.data.days;
  return out;
}

// combine averages several checks' days into one.
function combine(list: ((number | null)[] | undefined)[]): (number | null)[] {
  return Array.from({ length: 30 }, (_, d) => {
    const vals = list.map((x) => x?.[d]).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
}

function percent(v: number) {
  return `${v >= 99.995 ? "100" : v.toFixed(2)}%`;
}

// useCheckStats are a customer's, project's or environment's checks in
// three numbers: uptime over 30 days, the median response, and the days
// until the next certificate expires.
export function useCheckStats(checks: Check[]) {
  const days = useDailyUptime(checks);
  const ran = combine(checks.map((c) => days[c.id])).filter((v): v is number => v != null);
  const uptime = ran.length ? (100 * ran.reduce((a, b) => a + b, 0)) / ran.length : null;
  const lat = checks.map((c) => c.latency_ms).filter((v): v is number => v != null).sort((a, b) => a - b);
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : null;
  const certs = checks.map((c) => certDays(c)).filter((v): v is number => v != null);
  return { uptime: uptime != null ? percent(uptime) : null, median, cert: certs.length ? Math.min(...certs) : null };
}

// Welcome is home before there is anything: one question, and the way to
// answer it.
function Welcome() {
  const { t } = useTranslation();
  const { isAdmin } = useMe();
  return (
    <div className="mx-auto max-w-xl space-y-6 pt-[8vh] text-center">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("addThing.first")}</h1>
        <p className="text-muted-foreground">{t("addThing.whatHint")}</p>
      </div>
      {isAdmin && <AddThing big />}
      {isAdmin && (
        <p className="text-mini text-muted-foreground">
          <Link to="/start" className="hover:text-foreground hover:underline">
            {t("begin.guide")}
          </Link>
        </p>
      )}
    </div>
  );
}
