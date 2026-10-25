import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Download, Pencil, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteScope, exportURL, getScope, listChecks, listHosts, listScopes, NotFound, renameScope, updateScope, type HostSummary } from "@/api";
import { AlertHistory, useAlerts } from "@/components/Alerts";
import { useCheckStats } from "@/components/Dashboard";
import { Incidents } from "@/components/Incidents";
import { ThingList } from "@/components/ThingList";
import { AddThing } from "@/components/AddThing";
import { StatusIcon } from "@/components/shell/Dot";
import { Section, SettingsSheet } from "@/components/shell/SettingsSheet";
import { levelUnder, isFiring } from "@/lib/status";
import { things, type Thing } from "@/lib/things";
import { Channels } from "@/components/Channels";
import { Maintenance } from "@/components/Maintenance";
import { Config } from "@/components/Config";
import { ChooseFile } from "@/components/ApplyFile";
import { History } from "@/components/History";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/useMe";
import { useUpdates } from "@/lib/useUpdates";

// Scope is the page of a customer, project or environment: how it stands,
// what needs attention, and everything lotse watches there, servers and
// checks alike (decision 0027). What can be set is in a sheet at its side.
export function Scope({ id }: { id: number }) {
  const { t } = useTranslation();
  const { isAdmin } = useMe();
  const scope = useQuery({ queryKey: ["scope", id], queryFn: () => getScope(id) });
  const scopes = useQuery({ queryKey: ["scopes"], queryFn: listScopes });
  const hosts = useQuery({ queryKey: ["hosts"], queryFn: listHosts, refetchInterval: 60_000 });
  const checks = useQuery({ queryKey: ["checks", "all"], queryFn: () => listChecks(), refetchInterval: 30_000 });
  const alerts = useAlerts().data ?? [];
  const [settings, setSettings] = useState(false);
  // The checks in this scope, for its uptime; worked out before the page
  // knows whether the scope exists, as hooks must be.
  const scopePath = scope.data?.path;
  const envPath = new Map((scopes.data ?? []).map((s) => [s.id, s.path]));
  const inScope = (envID?: number | null) => {
    const p = envID ? envPath.get(envID) : undefined;
    return scopePath !== undefined && p !== undefined && (p === scopePath || p.startsWith(scopePath + "/"));
  };
  const stats = useCheckStats((checks.data ?? []).filter((c) => inScope(c.environment_id)));

  if (scope.isPending) return <Skeleton className="m-6 h-32" />;
  if (scope.error instanceof NotFound) return <p className="p-6">{t("tree.notFound")}</p>;
  if (scope.isError) return <p className="p-6 text-destructive">{t("app.unreachable")}</p>;

  const all = scopes.data ?? [];
  const byID = new Map(all.map((s) => [s.id, s]));
  const children = all.filter((s) => s.parent_id === id);
  const myHosts = (hosts.data ?? []).filter((h) => inScope(h.host.environment_id));
  const myChecks = (checks.data ?? []).filter((c) => inScope(c.environment_id));
  const list = things(myHosts, myChecks, alerts, all);
  const subject = `${scope.data.kind}:${id}`;
  const problems = alerts.filter((a) => isFiring(a) && (a.subject_path === scope.data.path || a.subject_path.startsWith(scope.data.path + "/")));
  // Things go under the project they are in, named from here, and under
  // its environment too where a project has more than one; headings only
  // where there is more than one group.
  const envsOf = (projectID: number) => all.filter((s) => s.parent_id === projectID).length;
  const groupOf = (x: Thing) => {
    const e = x.envID ? byID.get(x.envID) : undefined;
    if (!e) return { key: "~", label: t("overview.unassigned") };
    const names: string[] = [];
    for (let s: typeof e | undefined = e; s && s.id !== id; s = s.parent_id ? byID.get(s.parent_id) : undefined) {
      if (s.kind === "environment" && s.parent_id && envsOf(s.parent_id) < 2) continue;
      if (s.kind !== "customer") names.unshift(s.name);
    }
    return { key: names.join("/"), label: names.join(" · ") };
  };
  const grouped = new Set(list.map((x) => groupOf(x).key)).size > 1;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-start gap-3">
        {/* On a phone the name has the line to itself, the buttons go under it. */}
        <div className="min-w-0 flex-1 basis-full space-y-1 sm:basis-auto">
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {list.length > 0 && <StatusIcon level={levelUnder(alerts, scope.data.path)} size={22} />}
            <span className="truncate">{scope.data.name}</span>
          </h1>
          <p className="text-muted-foreground">
            {[
              t("thing.count", { count: list.length }),
              stats.uptime && t("stats.uptimeFact", { value: stats.uptime }),
              problems.length > 0 && <span style={{ color: problems.some((a) => a.state === "crit") ? "var(--crit)" : "var(--warn)" }}>{t("thing.needYou", { count: problems.length })}</span>,
            ]
              .filter(Boolean)
              .map((x, i) => (
                <Fragment key={i}>
                  {i > 0 && " · "}
                  {x}
                </Fragment>
              ))}
          </p>
        </div>
        <Button variant="outline" onClick={() => setSettings(true)}>
          {t("tabs.settings")}
        </Button>
        {isAdmin && <AddThing scope={scope.data} />}
      </div>

      {problems.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium">{t("thing.attention")}</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Incidents alerts={problems} from={scope.data.path} />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline">
          <h2 className="flex-1 font-medium">{t("thing.everything")}</h2>
          <span className="text-mini text-muted-foreground">{t("table.last24h")}</span>
        </div>
        {list.length === 0 ? <p className="rounded-xl border border-dashed px-6 py-10 text-center text-muted-foreground">{t("overview.nothingHere")}</p> : <ThingList things={list} group={grouped ? groupOf : undefined} />}
      </section>
      {isAdmin && <UpdateAgents scopeID={id} hosts={myHosts} />}

      <SettingsSheet open={settings} onOpenChange={setSettings} title={scope.data.name} description={`${t(`config.kinds.${scope.data.kind}`)} · ${scope.data.path}`}>
        <Section title={t("thing.settings.name")}>
          <Title id={id} name={scope.data.name} canEdit={isAdmin} />
        </Section>
        {/* Channels and maintenance name themselves. */}
        <Channels scopeID={id} subject={subject} name={scope.data.name} />
        <Maintenance subject={subject} />
        <Section title={t("thing.settings.rules")} hint={t("thing.settings.rulesHint")}>
          <Config subject={subject} />
        </Section>
        <Section title={t("thing.settings.history")}>
          <AlertHistory subject={subject} always />
          <History subject={subject} />
        </Section>
        {isAdmin && (
          <Section title={t("thing.settings.more")}>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" render={<a href={exportURL(scope.data.path)} download={`${scope.data.slug}.lotse.yaml`} />}>
                <Download />
                {t("token.download")}
              </Button>
              <ChooseFile />
            </div>
            {list.length === 0 && children.length === 0 && <Delete id={id} />}
          </Section>
        )}
      </SettingsSheet>
    </div>
  );
}

function Title({ id, name, canEdit }: { id: number; name: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const save = useMutation({
    mutationFn: () => renameScope(id, value),
    onSuccess: () => {
      setEditing(false);
      client.invalidateQueries({ queryKey: ["scope", id] });
      client.invalidateQueries({ queryKey: ["scopes"] });
      client.invalidateQueries({ queryKey: ["changes"] });
    },
  });
  if (!editing) {
    return (
      <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        {name}
        {canEdit && (
          <Button variant="ghost" size="icon-sm" aria-label={t("tree.rename")} onClick={() => (setValue(name), setEditing(true))}>
            <Pencil className="size-3.5" />
          </Button>
        )}
      </h1>
    );
  }
  return (
    <form
      className="flex max-w-md gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      <Button type="submit" size="sm" disabled={save.isPending}>
        {t("tree.save")}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
        {t("tree.cancel")}
      </Button>
    </form>
  );
}

function Delete({ id }: { id: number }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const del = useMutation({
    mutationFn: () => deleteScope(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["scopes"] });
      navigate({ to: "/" });
    },
  });
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={() => confirm(t("tree.deleteConfirm")) && del.mutate()}>
        <Trash2 className="size-4" />
        {t("tree.delete")}
      </Button>
      {del.isError && (
        <Alert variant="destructive">
          <AlertDescription>{del.error.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// UpdateAgents asks every agent in the scope that is behind to update.
export function UpdateAgents({ scopeID, hosts }: { scopeID: number; hosts: HostSummary[] }) {
  const { t } = useTranslation();
  const { updateFor, latest } = useUpdates();
  const behind = hosts.filter((h) => h.host.online && updateFor(h.host.agent_version));
  const ask = useMutation({ mutationFn: () => updateScope(scopeID) });
  if (!latest || behind.length === 0) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <Button size="sm" variant="outline" disabled={ask.isPending || ask.isSuccess} onClick={() => ask.mutate()}>
        {t("update.agents", { count: behind.length, version: latest })}
      </Button>
      {ask.isSuccess && <span className="text-muted-foreground">{t("update.asked", { count: ask.data.asked })}</span>}
      {ask.isError && <span className="text-destructive">{ask.error.message}</span>}
    </div>
  );
}
