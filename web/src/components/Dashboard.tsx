import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Activity, Search, Server } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getConfig, getSeries, listChecks, listHosts, listScopes, setHostEnvironment, type AlertState, type Check, type HostSummary, type Scope } from "@/api";
import { AddAgent } from "@/components/AddAgent";
import { useAlerts } from "@/components/Alerts";
import { certDays } from "@/components/CheckState";
import { Incidents } from "@/components/Incidents";
import { AddDialog, type What } from "@/components/shell/AddMenu";
import { StatusIcon } from "@/components/shell/Dot";
import { CheckTable, HostTable } from "@/components/Tables";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { alertTitle, subjectName } from "@/lib/alerts";
import { useLive } from "@/lib/live";
import { firing, levelUnder } from "@/lib/status";
import { useMe } from "@/lib/useMe";

const panel = "overflow-hidden rounded-xl border bg-card";

// Dashboard is home, for everything or for one customer, project or
// environment: how things stand, the problems there are, a tile for each
// customer (or project, or environment) below, and the hosts and checks.
// It shows only what exists: no hosts, no hosts tab; nothing at all, the
// ways to begin (decision 0026).
export function Dashboard({ scope }: { scope?: Scope }) {
  const { t } = useTranslation();
  const { isAdmin, isHubAdmin } = useMe();
  const hosts = useQuery({ queryKey: ["hosts"], queryFn: listHosts, refetchInterval: 60_000 });
  const scopes = useQuery({ queryKey: ["scopes"], queryFn: listScopes });
  const checks = useQuery({ queryKey: ["checks", "all"], queryFn: () => listChecks(), refetchInterval: 30_000 });
  const alerts = useAlerts().data ?? [];
  const moveHost = useMoveHost();
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

  if (hosts.isPending || scopes.isPending || checks.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (hosts.isError || scopes.isError || checks.isError) return <p className="text-destructive">{t("app.unreachable")}</p>;

  const all = scopes.data;
  const byID = new Map(all.map((s) => [s.id, s]));
  const ids = new Set(all.map((s) => s.id));
  const path = scope?.path ?? "";
  const inside = (p: string) => path === "" || p === path || p.startsWith(path + "/");
  const envIn = (envID?: number | null) => {
    const e = envID ? byID.get(envID) : undefined;
    return e ? inside(e.path) : path === "";
  };
  const myHosts = hosts.data.filter((h) => envIn(h.host.environment_id));
  const myChecks = checks.data.filter((c) => envIn(c.environment_id));
  const problems = firing(alerts).filter((a) => inside(a.subject_path));
  const env = scope?.kind === "environment";
  // The tiles are what lies one level below: the customers at home, a
  // customer's projects, a project's environments.
  const tiles = (scope ? all.filter((s) => s.parent_id === scope.id) : all.filter((s) => s.parent_id == null || !ids.has(s.parent_id))).sort((a, b) => a.name.localeCompare(b.name));
  // Names from here down: "Acme · Shop" at home, "Shop · Prod" on Acme's page.
  const whereOf = (envID?: number | null) => {
    const names: string[] = [];
    for (let x = envID ? byID.get(envID) : undefined; x && x.id !== scope?.id; x = x.parent_id ? byID.get(x.parent_id) : undefined) names.unshift(x.name);
    return names.slice(0, env ? 0 : 2).join(" · ");
  };
  const groupOf = (envID: number | null | undefined) => {
    const e = envID ? byID.get(envID) : undefined;
    const name = whereOf(envID);
    return {
      key: e?.path ?? "",
      name,
      label: e ? (
        <Link to="/scopes/$id" params={{ id: String(e.id) }} className="hover:underline" onClick={(ev) => ev.stopPropagation()}>
          {name}
        </Link>
      ) : (
        t("overview.unassigned")
      ),
    };
  };

  if (!scope && myHosts.length === 0 && myChecks.length === 0) return <Welcome />;

  return (
    <div className="space-y-6">
      {!scope && <Headline problems={problems.length} crit={problems.filter((a) => a.state === "crit").length} hosts={myHosts.length} checks={myChecks.length} />}
      {problems.length > 0 && (
        <section className={panel}>
          <Incidents alerts={problems} />
        </section>
      )}
      {!scope && isHubAdmin && <NotifyHint />}
      {tiles.length > 1 && <Tiles scopes={tiles} hosts={myHosts} checks={myChecks} alerts={alerts} byID={byID} kind={tiles[0].kind} />}
      {scope && myChecks.length > 0 && <Stats checks={myChecks} />}
      {myHosts.length + myChecks.length > 0 ? (
        <Inventory
          hosts={myHosts}
          checks={myChecks}
          host={(list) => (
            <HostTable
              hosts={list}
              alerts={alerts}
              where={scope ? undefined : (h) => whereOf(h.host.environment_id)}
              group={scope && !env ? (h) => groupOf(h.host.environment_id) : undefined}
              move={
                isAdmin && scope && !env
                  ? {
                      groups: all.filter((s) => s.kind === "environment" && inside(s.path)).map((s) => ({ ...groupOf(s.id), envID: s.id })),
                      onMove: (h, envID) => moveHost(h, envID, groupOf(envID).name),
                    }
                  : undefined
              }
            />
          )}
          check={(list) => <CheckTable checks={list} where={scope ? undefined : (c) => whereOf(c.environment_id)} group={scope && !env ? (c) => groupOf(c.environment_id) : undefined} />}
        />
      ) : (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-muted-foreground">{env ? t("overview.noHostsAdd") : t("overview.nothingHere")}</p>
      )}
      {env && isAdmin && myHosts.length === 0 && myChecks.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-muted-foreground">
          <span className="flex-1">{t("overview.noMachines", { name: scope.name })}</span>
          <AddAgent envID={scope.id} />
        </div>
      )}
    </div>
  );
}

// Headline says in one sentence how everything stands.
function Headline({ problems, crit, hosts, checks }: { problems: number; crit: number; hosts: number; checks: number }) {
  const { t } = useTranslation();
  const level = crit ? "crit" : problems ? "warn" : "ok";
  const text = crit
    ? [t("overview.critical", { count: crit }), problems > crit && t("overview.warnings", { count: problems - crit })].filter(Boolean).join(", ")
    : problems
      ? t("overview.warnings", { count: problems })
      : t("overview.allGood");
  return (
    <div className="space-y-1">
      <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
        <StatusIcon level={level} size={22} />
        {text}
      </h1>
      <p className="text-muted-foreground">{[hosts > 0 && t("overview.hostCount", { count: hosts }), checks > 0 && t("overview.checkCount", { count: checks })].filter(Boolean).join(" · ")}</p>
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

// Tiles show each customer (or project, or environment) below: how it
// stands, what it has, and its checks' last 30 days, a slice a day.
function Tiles({ scopes, hosts, checks, alerts, byID, kind }: { scopes: Scope[]; hosts: HostSummary[]; checks: Check[]; alerts: AlertState[]; byID: Map<number, Scope>; kind: string }) {
  const { t } = useTranslation();
  const days = useDailyUptime(checks);
  const pathOf = (envID?: number | null) => (envID ? byID.get(envID)?.path ?? "" : "");
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="font-semibold">{t(`tiles.${kind}`)}</h2>
        <span className="text-muted-foreground tabular-nums">{scopes.length}</span>
        <span className="flex-1" />
        <span className="text-mini text-muted-foreground">{t("tiles.last30")}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {scopes.map((s) => {
          const under = (p: string) => p === s.path || p.startsWith(s.path + "/");
          const h = hosts.filter((x) => under(pathOf(x.host.environment_id)));
          const c = checks.filter((x) => under(pathOf(x.environment_id)));
          const offline = h.filter((x) => !x.host.online && !x.host.waiting).length;
          const problem = firing(alerts).find((a) => under(a.subject_path));
          const strip = combine(c.map((x) => days[x.id]));
          const ran = strip.filter((v): v is number => v != null);
          const uptime = ran.length ? (100 * ran.reduce((a, b) => a + b, 0)) / ran.length : null;
          return (
            <Link
              key={s.id}
              to="/scopes/$id"
              params={{ id: String(s.id) }}
              className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-center gap-2">
                <StatusIcon level={levelUnder(alerts, s.path)} />
                <span className="flex-1 truncate font-semibold">{s.name}</span>
                {uptime != null && <span className="text-mini text-muted-foreground tabular-nums">{percent(uptime)}</span>}
              </div>
              <p className="text-mini text-muted-foreground">
                {[
                  h.length > 0 && t("overview.hostCount", { count: h.length }),
                  offline > 0 && t("tiles.offline", { count: offline }),
                  c.length > 0 && t("overview.checkCount", { count: c.length }),
                ]
                  .filter(Boolean)
                  .join(" · ") || t("tiles.empty")}
              </p>
              {c.length > 0 && <Strip days={strip} />}
              {problem && (
                <p className="truncate text-mini font-medium" style={{ color: problem.state === "crit" ? "var(--crit)" : "var(--warn)" }}>
                  {subjectName(problem).name} · {alertTitle(t, problem)}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Strip({ days }: { days: (number | null)[] }) {
  return (
    <div className="flex h-5 gap-[2px]">
      {days.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1.5px]"
          style={{ background: v == null ? "var(--muted)" : v >= 0.999 ? "var(--ok)" : v >= 0.5 ? "var(--warn)" : "var(--crit)" }}
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

// Stats are a customer's, project's or environment's checks in three
// numbers.
function Stats({ checks }: { checks: Check[] }) {
  const { t } = useTranslation();
  const days = useDailyUptime(checks);
  const ran = combine(checks.map((c) => days[c.id])).filter((v): v is number => v != null);
  const uptime = ran.length ? (100 * ran.reduce((a, b) => a + b, 0)) / ran.length : null;
  const lat = checks.map((c) => c.latency_ms).filter((v): v is number => v != null).sort((a, b) => a - b);
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : null;
  const certs = checks.map((c) => certDays(c)).filter((v): v is number => v != null);
  const cert = certs.length ? Math.min(...certs) : null;
  const stat = (label: string, value: ReactNode, warn = false) => (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-mini text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tracking-tight tabular-nums" style={warn ? { color: "var(--warn)" } : undefined}>
        {value}
      </p>
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stat(t("stats.uptime"), uptime != null ? percent(uptime) : "–")}
      {stat(t("stats.response"), median != null ? `${Math.round(median)} ms` : "–")}
      {stat(t("stats.cert"), cert != null ? t("stats.inDays", { count: cert }) : "–", cert != null && cert < 14)}
    </div>
  );
}

// Inventory is the hosts and the checks in one panel, a switch between
// them, and a filter; the switch appears only when there are both.
function Inventory({ hosts, checks, host, check }: { hosts: HostSummary[]; checks: Check[]; host: (h: HostSummary[]) => ReactNode; check: (c: Check[]) => ReactNode }) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<"hosts" | "checks">(() => (localStorage.getItem("lotse.inventory") === "checks" ? "checks" : "hosts"));
  const [filter, setFilter] = useState("");
  const tab = hosts.length === 0 ? "checks" : checks.length === 0 ? "hosts" : chosen;
  const choose = (v: "hosts" | "checks") => (localStorage.setItem("lotse.inventory", v), setChosen(v));
  const text = filter.toLowerCase();
  const shownHosts = hosts.filter((h) => h.host.name.toLowerCase().includes(text));
  const shownChecks = checks.filter((c) => `${c.name} ${c.path}`.toLowerCase().includes(text));
  const shown = tab === "hosts" ? shownHosts.length : shownChecks.length;
  const both = hosts.length > 0 && checks.length > 0;
  return (
    <section className={panel}>
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        {both ? (
          <div role="tablist" className="flex gap-0.5 rounded-lg bg-muted p-[3px]">
            {(["hosts", "checks"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={tab === v}
                onClick={() => choose(v)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${tab === v ? "chip" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t(`nav.${v}`)}
                <span className="text-mini text-muted-foreground tabular-nums">{v === "hosts" ? hosts.length : checks.length}</span>
              </button>
            ))}
          </div>
        ) : (
          <h2 className="flex items-baseline gap-2 font-semibold">
            {t(`nav.${tab}`)}
            <span className="font-normal text-muted-foreground tabular-nums">{tab === "hosts" ? hosts.length : checks.length}</span>
          </h2>
        )}
        <div className="flex-1" />
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("rows.filter")} className="h-8 w-52 pl-8" />
        </div>
      </header>
      <div className="border-t">
        {shown === 0 ? <p className="px-4 py-10 text-center text-muted-foreground">{t("rows.noMatch")}</p> : tab === "hosts" ? host(shownHosts) : check(shownChecks)}
      </div>
    </section>
  );
}

// Welcome is home before there is anything: the two ways to begin.
function Welcome() {
  const { t } = useTranslation();
  const { isAdmin } = useMe();
  const [what, setWhat] = useState<What | null>(null);
  const choice = (key: "host" | "check", icon: ReactNode) => (
    <button
      type="button"
      disabled={!isAdmin}
      onClick={() => setWhat(key)}
      className="flex flex-col items-start gap-2 rounded-xl border bg-card p-6 text-left transition-colors hover:border-brand/40 disabled:pointer-events-none"
    >
      <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand">{icon}</span>
      <span className="text-lg font-semibold">{t(`begin.${key}.title`)}</span>
      <span className="text-muted-foreground">{t(`begin.${key}.text`)}</span>
      {isAdmin && <span className="mt-1 font-medium text-brand">{t(`begin.${key}.action`)} →</span>}
    </button>
  );
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("overview.welcome")}</h1>
        <p className="text-muted-foreground">{t("begin.question")}</p>
      </div>
      <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
        {choice("host", <Server className="size-5" />)}
        {choice("check", <Activity className="size-5" />)}
      </div>
      {isAdmin && (
        <p className="text-muted-foreground">
          <Link to="/start" className="text-brand hover:underline">
            {t("begin.guide")}
          </Link>
        </p>
      )}
      <AddDialog what={what} onClose={() => setWhat(null)} />
    </div>
  );
}

// useMoveHost moves a host to another environment, with a toast that can
// take it back.
function useMoveHost() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const move = useMutation({
    mutationFn: ({ h, envID }: { h: HostSummary; envID: number | null; to: string; undo?: boolean }) => setHostEnvironment(h.host.id, envID),
    onSuccess: (_, { h, to, undo }) => {
      client.invalidateQueries({ queryKey: ["hosts"] });
      client.invalidateQueries({ queryKey: ["host", h.host.id] });
      client.invalidateQueries({ queryKey: ["changes"] });
      if (undo) return;
      const from = h.host.environment_id ?? null;
      toast.success(t("move.moved", { name: h.host.name, to }), {
        action: { label: t("move.undo"), onClick: () => move.mutate({ h, envID: from, to: "", undo: true }) },
      });
    },
    onError: (e) => toast.error(e.message),
  });
  return (h: HostSummary, envID: number, to: string) => move.mutate({ h, envID, to });
}
