import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Clock, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { acknowledgeAlert, listScopes, type AlertState } from "@/api";
import { StatusIcon } from "@/components/shell/Dot";
import { Button } from "@/components/ui/button";
import { alertTitle, subjectName } from "@/lib/alerts";
import { ago, dateTime } from "@/lib/format";
import { levelColor, levelOf, isFiring } from "@/lib/status";
import { useMe } from "@/lib/useMe";

// Incidents lists what needs attention, worst first, each as one short
// line: on what, what is wrong, where, since when; and who looks after it.
// Where is named from the page down (from, a scope's path): "Online shop ·
// Staging" on the customer's page. The numbers are on the alert's page.
export function Incidents({ alerts, from = "" }: { alerts: AlertState[]; from?: string }) {
  const scopes = useQuery({ queryKey: ["scopes"], queryFn: listScopes });
  const all = scopes.data ?? [];
  const byPath = new Map(all.map((s) => [s.path, s]));
  const byID = new Map(all.map((s) => [s.id, s]));
  // The names of the scopes an alert lies in, below from, at most two.
  const place = (path: string) => {
    let scope;
    for (let p = path; p && !scope; p = p.slice(0, Math.max(0, p.lastIndexOf("/")))) scope = byPath.get(p);
    const names: string[] = [];
    for (let x = scope; x && x.path !== from; x = x.parent_id ? byID.get(x.parent_id) : undefined) names.unshift(x.name);
    return names.slice(0, 2).join(" · ");
  };
  return (
    <ul>
      {alerts.map((a) => (
        <Incident key={`${a.rule}|${a.subject_kind}|${a.subject_id}|${a.instance}`} alert={a} where={place(subjectName(a).where)} />
      ))}
    </ul>
  );
}

function Incident({ alert: a, where }: { alert: AlertState; where: string }) {
  const { t } = useTranslation();
  const { isAdmin } = useMe();
  const client = useQueryClient();
  const ack = useMutation({
    mutationFn: () => acknowledgeAlert(a.alert_id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["alerts"] }),
  });
  const { name } = subjectName(a);
  return (
    <li className="group flex min-h-11 items-center gap-3 px-4 py-2 transition-colors duration-100 hover:bg-accent/60 sm:py-0">
      {!isFiring(a) && a.pending ? (
        <span title={t("alert.pendingTitle")}>
          <Clock className="size-3.5" style={{ color: levelColor[a.pending] }} />
        </span>
      ) : (
        <StatusIcon level={levelOf(a)} />
      )}
      <Link to="/alerts/$id" params={{ id: String(a.alert_id) }} className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2" title={a.reason || undefined}>
        <span className="truncate sm:shrink-0">
          <span className="font-medium">{name}</span>
          {a.instance && <code className="ml-1.5 rounded bg-muted px-1 py-px font-mono text-mini">{a.instance}</code>}
        </span>
        <span className="truncate text-muted-foreground sm:text-foreground">{t(`alert.phrases.${a.rule}`, { defaultValue: alertTitle(t, a) })}</span>
        {where && <span className="hidden truncate text-mini text-muted-foreground md:inline">{where}</span>}
      </Link>
      <div className="flex shrink-0 items-center gap-4 text-mini text-muted-foreground">
        {a.in_maintenance && (
          <span title={t("alert.inMaintenance")}>
            <Wrench className="size-3.5" />
          </span>
        )}
        {a.acked_by ? (
          <span className="hidden items-center gap-1 sm:inline-flex" title={t("alert.ackedBy", { who: a.acked_by })}>
            <Check className="size-3.5" />
            {a.acked_by.split("@")[0]}
          </span>
        ) : (
          isAdmin &&
          isFiring(a) && (
            <Button size="xs" variant="outline" className="hidden transition-opacity md:inline-flex md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" disabled={ack.isPending} onClick={() => ack.mutate()}>
              {t("alert.acknowledge")}
            </Button>
          )
        )}
        {isFiring(a) ? (
          <span className="w-14 text-right tabular-nums" title={dateTime(a.since)}>
            {ago(a.since)}
          </span>
        ) : (
          <span className="w-14 text-right">{t("alert.pending")}</span>
        )}
      </div>
    </li>
  );
}
