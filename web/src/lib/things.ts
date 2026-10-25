import type { AlertState, Check, HostSummary, Scope } from "@/api";
import { checkLevel, hostLevel } from "@/components/Rows";
import type { Level } from "@/lib/status";

// A thing is whatever lotse watches: a server with its agent, or a check
// from outside (a website, an API, a port, a certificate, a domain, DNS, a
// cron job). The interface shows them alike: a name, what kind it is, how
// it stands, its last day, and one figure (decision 0027).
export type Thing =
  | { key: string; kind: "server"; id: number; name: string; envID: number | null; level: Level; host: HostSummary }
  | { key: string; kind: CheckKind; id: number; name: string; envID: number | null; level: Level; check: Check };

export type CheckKind = "website" | "port" | "certificate" | "dns" | "domain" | "cron";

const checkKinds: Record<Check["type"], CheckKind> = {
  http: "website",
  tcp: "port",
  tls: "certificate",
  dns: "dns",
  domain: "domain",
  heartbeat: "cron",
};

// fromHost makes a thing of a host. Its environment's path, if known, makes
// its own (the environment's and its slug, which is its name), so that its
// containers' alerts count for it.
export function fromHost(h: HostSummary, alerts: AlertState[], envPath?: string): Thing {
  const path = envPath ? `${envPath}/${h.host.name}` : undefined;
  return { key: `host:${h.host.id}`, kind: "server", id: h.host.id, name: h.host.name, envID: h.host.environment_id ?? null, level: hostLevel(h, alerts, path), host: h };
}

export function fromCheck(c: Check): Thing {
  return { key: `check:${c.id}`, kind: checkKinds[c.type] ?? "website", id: c.id, name: c.name, envID: c.environment_id, level: checkLevel(c), check: c };
}

// things are all hosts and checks as things, worst first, then by name.
export function things(hosts: HostSummary[], checks: Check[], alerts: AlertState[], scopes: Scope[] = []): Thing[] {
  const rank: Record<Level, number> = { crit: 0, warn: 1, unknown: 2, ok: 3 };
  const pathOf = new Map(scopes.map((s) => [s.id, s.path]));
  return [...hosts.map((h) => fromHost(h, alerts, h.host.environment_id ? pathOf.get(h.host.environment_id) : undefined)), ...checks.map(fromCheck)].sort((a, b) => rank[a.level] - rank[b.level] || a.name.localeCompare(b.name));
}

export function thingPath(t: Thing): { to: "/hosts/$id" | "/checks/$id"; params: { id: string } } {
  return t.kind === "server" ? { to: "/hosts/$id", params: { id: String(t.id) } } : { to: "/checks/$id", params: { id: String(t.id) } };
}
