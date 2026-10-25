import type { AlertState, Check, HostSummary } from "@/api";
import { levelOfSubject, worse, type Level } from "@/lib/status";

// How a host and a check stand, for lists and tables.

// path is the host's key, such as acme/shop/prod/web-01; with it, what is
// wrong with its containers counts for the host too.
export function hostLevel(h: HostSummary, alerts: AlertState[], path?: string): Level {
  if (h.host.waiting) return "unknown";
  if (!h.host.online) return h.host.agent_revoked ? "unknown" : "crit";
  return worse(levelOfSubject(alerts, "host", h.host.id, path), h.containers.unhealthy > 0 ? "warn" : "ok");
}

export function checkLevel(c: Check): Level {
  return c.state === "down" ? "crit" : c.state === "up" ? "ok" : "unknown";
}

