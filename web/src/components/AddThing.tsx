import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Activity, Plus, Server } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createCheck, createEnvironment, getCheck, listScopes, tryCheck, type CheckTryResult, type Scope } from "@/api";
import { AgentBody } from "@/components/AddAgent";
import { CheckForm } from "@/components/AddCheck";
import { Command } from "@/components/Command";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/slug";

// What an address is: lotse works it out, so that adding asks for one line
// and not for a type (decision 0027). A server and a cron job have no
// address to type; "other" is every other kind of check, in its full form.
type Kind = "website" | "port" | "server" | "cron" | "other";

export function detect(input: string): { kind: Kind; spec: Record<string, unknown>; name: string } | null {
  const v = input.trim();
  if (!v) return null;
  if (/^https?:\/\/\S+$/i.test(v)) {
    try {
      return { kind: "website", spec: { url: v }, name: new URL(v).host };
    } catch {
      return null;
    }
  }
  const port = /^([\w.-]+):(\d{1,5})$/.exec(v);
  if (port) return { kind: "port", spec: { address: v }, name: v };
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return { kind: "website", spec: { url: `https://${v}` }, name: v.split("/")[0] };
  return null;
}

// AddThing adds whatever lotse should watch: first what, then for whom,
// then it runs. A scope given (a customer's page) is chosen already.
// Big, it is a field to type into, as on a new hub's home.
export function AddThing({ scope, compact = false, big = false }: { scope?: Scope; compact?: boolean; big?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {big ? (
        <DialogTrigger className="flex h-14 w-full items-center rounded-xl border bg-background px-4 text-left text-base text-muted-foreground shadow-xs transition-colors hover:border-brand/40">
          https://shop.example.com
        </DialogTrigger>
      ) : (
        <DialogTrigger render={compact ? <Button size="icon-sm" aria-label={t("add.title")} /> : <Button size="sm" />}>
          <Plus />
          {!compact && t("add.title")}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">{open && <Flow scope={scope} done={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function Flow({ scope, done }: { scope?: Scope; done: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [envID, setEnvID] = useState<number | null>(null);
  const found = detect(text);
  const what = kind === "website" || kind === "port" ? found : null;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const bar = (
    <div className="mb-2 flex gap-1.5">
      {[1, 2, 3].map((n) => (
        <span key={n} className={`h-[3px] flex-1 rounded-full ${n <= step ? "bg-brand" : "bg-muted"}`} />
      ))}
    </div>
  );

  if (step === 1) {
    const next = () => found && (setKind(found.kind), setStep(2));
    const card = (k: Kind, icon: React.ReactNode) => (
      <button type="button" onClick={() => (setKind(k), setStep(2))} className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:border-brand/40 hover:bg-accent/40">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <span>
          <span className="block font-medium">{t(`addThing.${k}.title`)}</span>
          <span className="text-mini text-muted-foreground">{t(`addThing.${k}.text`)}</span>
        </span>
      </button>
    );
    return (
      <div className="space-y-4">
        {bar}
        <DialogHeader>
          <DialogTitle>{t("addThing.what")}</DialogTitle>
          <DialogDescription>{t("addThing.whatHint")}</DialogDescription>
        </DialogHeader>
        <Input ref={input} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && next()} placeholder="https://shop.example.com  ·  db.example.com:5432" className="h-12 text-base" />
        <p className="min-h-5 text-mini text-muted-foreground">{found && t(`addThing.detected.${found.kind}`, { name: found.kind === "website" ? (found.spec.url as string) : found.name })}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {card("server", <Server className="size-4" />)}
          {card("cron", <Activity className="size-4" />)}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="text-mini text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => (setKind("other"), setStep(2))}>
            {t("addThing.otherLink")}
          </button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={done}>
              {t("tree.cancel")}
            </Button>
            <Button disabled={!found} onClick={next}>
              {t("addThing.next")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4">
        {bar}
        <DialogHeader>
          <DialogTitle>{t("addThing.who")}</DialogTitle>
          <DialogDescription>{what ? what.name : t(`addThing.${kind}.title`)}</DialogDescription>
        </DialogHeader>
        <Whom scope={scope} onBack={() => setStep(1)} onChosen={(id) => (setEnvID(id), setStep(3))} label={kind === "website" || kind === "port" || kind === "cron" ? t("addThing.start") : t("addThing.next")} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bar}
      {kind === "server" && <AgentBody envID={envID!} onDone={done} />}
      {kind === "other" && <CheckForm envID={envID!} onDone={done} />}
      {(kind === "website" || kind === "port" || kind === "cron") && <Started kind={kind} envID={envID!} what={what} done={done} />}
    </div>
  );
}

// Whom asks for the customer, and a group within it (a project). An
// environment is not asked for: a group's only one is taken, or one is
// made; only where a group has several is it chosen.
function Whom({ scope, onBack, onChosen, label }: { scope?: Scope; onBack: () => void; onChosen: (envID: number) => void; label: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const scopes = useQuery({ queryKey: ["scopes"], queryFn: listScopes });
  const all = scopes.data ?? [];
  const byID = new Map(all.map((s) => [s.id, s]));
  // Where the page given lies: its customer, its project, its environment.
  const up = (s: Scope | undefined, kind: string): Scope | undefined => {
    for (let x = s; x; x = x.parent_id ? byID.get(x.parent_id) : undefined) if (x.kind === kind) return x;
    return undefined;
  };
  const customers = all.filter((s) => s.kind === "customer").sort((a, b) => a.name.localeCompare(b.name));
  const [customer, setCustomer] = useState<string>(() => String(up(scope, "customer")?.id ?? ""));
  const [newCustomer, setNewCustomer] = useState("");
  const c = customer ? byID.get(Number(customer)) : undefined;
  const projects = c ? all.filter((s) => s.parent_id === c.id).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const [project, setProject] = useState<string>(() => String(up(scope, "project")?.id ?? ""));
  const [newProject, setNewProject] = useState("");
  const p = project === "new" ? undefined : project ? byID.get(Number(project)) : projects[0];
  const envs = p ? all.filter((s) => s.parent_id === p.id).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const [env, setEnv] = useState<string>(() => String(up(scope, "environment")?.id ?? ""));
  const e = env ? byID.get(Number(env)) : envs[0];

  const make = useMutation({
    mutationFn: async () => {
      if (e && p && e.parent_id === p.id) return e;
      const customerName = c?.name ?? newCustomer.trim();
      const projectName = p?.name ?? (newProject.trim() || customerName);
      return createEnvironment({
        customer: { slug: c?.slug ?? slugify(customerName), name: customerName },
        project: { slug: p?.slug ?? slugify(projectName), name: projectName },
        environment: { slug: "production", name: "Production" },
      });
    },
    onSuccess: async (made) => {
      await client.invalidateQueries({ queryKey: ["scopes"] });
      onChosen(made.id);
    },
  });
  const ready = (c || newCustomer.trim()) && !make.isPending;
  const select = "h-9 w-full rounded-md border border-input bg-background px-3 shadow-xs";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="add-customer">{t("addThing.customer")}</Label>
        <select id="add-customer" className={select} value={customer} onChange={(ev) => (setCustomer(ev.target.value), setProject(""), setEnv(""))}>
          {customers.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
          <option value="">{t("addThing.newCustomer")}</option>
        </select>
        {!c && <Input value={newCustomer} onChange={(ev) => setNewCustomer(ev.target.value)} placeholder={t("addThing.customerName")} autoFocus />}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="add-project">
          {t("addThing.group")} <span className="font-normal text-muted-foreground">{t("addThing.optional")}</span>
        </Label>
        {projects.length > 0 && (
          <select id="add-project" className={select} value={p ? String(p.id) : "new"} onChange={(ev) => (setProject(ev.target.value), setEnv(""))}>
            {projects.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
            <option value="new">{t("addThing.newGroup")}</option>
          </select>
        )}
        {!p && <Input value={newProject} onChange={(ev) => setNewProject(ev.target.value)} placeholder={t("addThing.groupName")} />}
      </div>
      {p && envs.length > 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="add-env">{t("add.environmentLabel")}</Label>
          <select id="add-env" className={select} value={e ? String(e.id) : ""} onChange={(ev) => setEnv(ev.target.value)}>
            {envs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {make.isError && <p className="text-mini text-destructive">{make.error.message}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>
          {t("addThing.back")}
        </Button>
        <Button disabled={!ready} onClick={() => make.mutate()}>
          {label}
        </Button>
      </div>
    </div>
  );
}

// Started adds the check, tries it once, and says what came back; for a
// cron job, the address the job is to call.
function Started({ kind, envID, what, done }: { kind: "website" | "port" | "cron"; envID: number; what: ReturnType<typeof detect>; done: () => void }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const type = kind === "website" ? "http" : kind === "port" ? "tcp" : "heartbeat";
  const spec = kind === "cron" ? { period: "24h", grace: "1h" } : what!.spec;
  const name = kind === "cron" ? t("addThing.cron.title") : what!.name;
  const [tried, setTried] = useState<CheckTryResult | null>(null);
  const add = useMutation({
    mutationFn: async () => {
      if (kind !== "cron") setTried(await tryCheck({ environment_id: envID, type, spec }).catch(() => null));
      const made = await createCheck({ environment_id: envID, name, type, spec });
      return getCheck(made.id);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["checks"] }),
  });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    add.mutate();
  }, [add]);
  if (add.isError) return <p className="text-destructive">{add.error.message}</p>;
  if (!add.data) return <p className="py-6 text-center text-muted-foreground">{t("addThing.starting")}</p>;
  const c = add.data;
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t("addThing.watching", { name: c.name })}</DialogTitle>
        <DialogDescription>
          {kind === "cron"
            ? t("addThing.cronHint")
            : tried
              ? tried.ok
                ? t("addThing.firstOk", { what: [tried.status_code && `HTTP ${tried.status_code}`, `${Math.round(tried.latency_ms)} ms`].filter(Boolean).join(", ") })
                : t("addThing.firstBad", { what: tried.error ?? "" })
              : t("addThing.firstNone")}
        </DialogDescription>
      </DialogHeader>
      {kind === "cron" && c.ping_url && <Command text={`curl -fsS ${c.ping_url}`} hint={t("addThing.cronCommand")} />}
      <p className="text-mini text-muted-foreground">{t("addThing.rulesApply")}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={done}>
          {t("addThing.done")}
        </Button>
        <Button onClick={() => (done(), navigate({ to: "/checks/$id", params: { id: String(c.id) } }))}>{t("addThing.open")}</Button>
      </div>
    </div>
  );
}
