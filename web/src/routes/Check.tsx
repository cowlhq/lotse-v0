import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check as CheckIcon, Copy, MoreHorizontal, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { deleteCheck, getCheck, getSeries, listEvents, NotFound, type CheckDetail } from "@/api";
import { ObjectRules } from "@/components/AlertBell";
import { AlertHistory, useAlerts } from "@/components/Alerts";
import { Chart, type Line } from "@/components/Chart";
import { certDays, target } from "@/components/CheckState";
import { Config } from "@/components/Config";
import { Events } from "@/components/Events";
import { History } from "@/components/History";
import { Incidents } from "@/components/Incidents";
import { Maintenance } from "@/components/Maintenance";
import { RangePicker, type RangeSeconds } from "@/components/Range";
import { StatusIcon } from "@/components/shell/Dot";
import { Page } from "@/components/shell/PageHeader";
import { Section, SettingsSheet } from "@/components/shell/SettingsSheet";
import { fromCheck } from "@/lib/things";
import { Facts, ObjectHeader, Panel } from "@/components/shell/Panel";
import { ScopeTrail } from "@/components/shell/ScopeTrail";
import { UptimeBar } from "@/components/UptimeBar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ago, dateTime, number, percent } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import { useRange } from "@/lib/useRange";
import { isFiring } from "@/lib/status";

export function Check({ id }: { id: number }) {
  const { t } = useTranslation();
  const { isAdmin } = useMe();
  const [seconds, setSeconds] = useState<RangeSeconds>(3600);
  const [settings, setSettings] = useState(false);
  const range = useRange(seconds);
  const check = useQuery({ queryKey: ["check", id], queryFn: () => getCheck(id), refetchInterval: 10_000 });
  const series = useQuery({
    queryKey: ["series", "checks", id, range],
    queryFn: () => getSeries("checks", id, range),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
  });
  const events = useQuery({
    queryKey: ["events", "check", id, range],
    queryFn: () => listEvents(`check:${id}`, range),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
  });
  const alertsQuery = useAlerts();
  const lines: Line[] = useMemo(() => [{ key: "latency_ms", label: t("check.latency") }], [t]);
  const format = useMemo(() => (v: number | null, d?: number) => (v == null ? "–" : `${number(v, d ?? 0)} ms`), []);

  if (check.isPending) return <Skeleton className="m-6 h-64" />;
  if (check.error instanceof NotFound) return <p className="p-6">{t("check.notFound")}</p>;
  if (check.isError) return <p className="p-6 text-destructive">{t("app.unreachable")}</p>;
  const c = check.data;
  // The share of runs that passed, over the range shown.
  const ok = series.data?.columns.ok?.filter((v): v is number => v != null) ?? [];
  const uptime = ok.length ? (100 * ok.reduce((a, b) => a + b, 0)) / ok.length : undefined;
  const days = certDays(c);
  const useAlertsData = alertsQuery.data;

  const alerts = (useAlertsData ?? []).filter((x) => isFiring(x) && x.subject_kind === "check" && x.subject_id === id);
  const level = c.state === "down" ? "crit" : c.state === "up" ? "ok" : "unknown";
  const subject = `check:${id}`;

  return (
    <>
      <ObjectHeader
        above={<ScopeTrail envID={c.environment_id} />}
        icon={<StatusIcon level={level} size={22} />}
        title={c.name}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setSettings(true)}>
              {t("tabs.settings")}
            </Button>
            {isAdmin && <CheckMenu id={id} envID={c.environment_id} />}
          </>
        }
        facts={
          <Facts
            items={[
              <span style={c.state === "down" ? { color: "var(--crit)" } : undefined}>
                {t(`check.state.${c.state}`)}
                {c.state_since && <> {t("check.since", { time: ago(c.state_since) })}</>}
              </span>,
              t(`check.kind.${c.type}`),
              <span className="font-mono text-mini">{target(c)}</span>,
              c.type !== "heartbeat" && uptime != null && t("check.uptimeFact", { value: percent(uptime, uptime < 99.995 && uptime > 0.005 ? 2 : 0) }),
              c.latency_ms != null && `${Math.round(c.latency_ms)} ms`,
              // A domain check keeps its registration's end where others
              // keep a certificate's.
              days != null && (
                <span style={days < (c.type === "domain" ? 30 : 14) ? { color: "var(--warn)" } : undefined}>
                  {t(c.type === "domain" ? "check.domainIn" : "check.certIn", { count: days })}
                </span>
              ),
            ]}
          />
        }
      />
      <Page>
        {c.state === "down" && c.error && (
          <p className="rounded-lg border px-4 py-3" style={{ borderColor: "color-mix(in oklch, var(--crit) 35%, transparent)", color: "var(--crit)" }}>
            {c.error}
          </p>
        )}
        {alerts.length > 0 && (
          <section className="overflow-hidden rounded-xl border bg-card">
            <Incidents alerts={alerts} />
          </section>
        )}
        {c.type === "heartbeat" ? (
          <Heartbeat check={c} />
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="font-medium">{t("thing.last30")}</h2>
              <UptimeBar checkID={id} slices={30} hours={720} fill />
            </section>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-medium">{t("check.latency")}</h2>
                <RangePicker value={seconds} onChange={setSeconds} />
              </div>
              <Panel>
                <Chart data={series.data} lines={lines} format={format} range={range} events={events.data} />
              </Panel>
            </section>
            <Probes check={c} />
          </>
        )}
        <section className="space-y-3">
          <h2 className="font-medium">{t("thing.settings.history")}</h2>
          <AlertHistory subject={subject} always />
          <Events events={events.data ?? []} />
        </section>
      </Page>
      <SettingsSheet open={settings} onOpenChange={setSettings} title={c.name} description={t(`thing.kind.${fromCheck(c).kind}`)}>
        <Section title={t("thing.settings.tell")} hint={t("thing.settings.tellHint")}>
          <ObjectRules subject={subject} kind={c.type === "heartbeat" ? "heartbeat" : "check"} />
        </Section>
        <Maintenance subject={subject} />
        <Section title={t("thing.settings.advanced")} hint={t("thing.settings.advancedHint")}>
          <Config subject={subject} envID={c.environment_id} />
        </Section>
        <Section title={t("thing.settings.changes")}>
          <History subject={subject} />
        </Section>
      </SettingsSheet>
    </>
  );
}

// CheckMenu holds what is seldom done to a check: deleting it.
function CheckMenu({ id, envID }: { id: number; envID: number }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const del = useMutation({
    mutationFn: () => deleteCheck(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["checks"] });
      toast.success(t("check.deleted"));
      navigate({ to: "/scopes/$id", params: { id: String(envID) } });
    },
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t("host.more")} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem variant="destructive" onClick={() => confirm(t("check.deleteConfirm")) && del.mutate()}>
          <Trash2 />
          {t("check.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Probes({ check }: { check: CheckDetail }) {
  const { t } = useTranslation();
  if (check.probes.length === 0) return null;
  return (
    <Panel title={t("check.byProbe")} flush>
      <ul>
        {check.probes.map((r) => (
          <li key={r.probe} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
            <StatusIcon level={r.ok ? "ok" : "crit"} />
            <span className="font-medium">{r.probe}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {r.status_code != null && <>HTTP {r.status_code}</>}
              {r.error && <span style={{ color: "var(--crit)" }}> {r.error}</span>}
            </span>
            <span className="tabular-nums">{r.latency_ms != null ? `${number(r.latency_ms, 0)} ms` : "–"}</span>
            <span className="w-20 text-right text-mini text-muted-foreground" title={dateTime(r.ts)}>
              {t("ago", { time: ago(r.ts) })}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// Heartbeat shows where to ping and how, from a cron job or a script.
function Heartbeat({ check }: { check: CheckDetail }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState("");
  const url = check.ping_url;
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(""), 1500);
  };
  return (
    <Panel title={t("check.pingTitle")}>
      <div className="space-y-3">
        <p>{check.last_ping ? t("check.lastPing", { time: ago(check.last_ping) }) : t("check.noPing")}</p>
        {url ? (
          <>
            <p className="text-muted-foreground">{t("check.pingHint")}</p>
            {[`curl -fsS ${url}`, `backup.sh && curl -fsS ${url} || curl -fsS ${url}/fail`].map((cmd) => (
              <div key={cmd} className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-2 font-mono text-mini">{cmd}</code>
                <Button variant="ghost" size="icon-sm" aria-label={t("agent.copy")} onClick={() => copy(cmd)}>
                  {copied === cmd ? <CheckIcon className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            ))}
          </>
        ) : (
          <p className="text-muted-foreground">{t("check.pingAdminOnly")}</p>
        )}
      </div>
    </Panel>
  );
}
