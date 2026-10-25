import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { listScopes, type Scope } from "@/api";
import { useShowScope } from "@/components/shell/TopBar";

// ScopeTrail is where an object is, by name: Acme / Shop / Production, each
// leading to its page, and what else is above it, such as a container's
// host. It tells the bar whose the page is; where the bar has room to show
// the same trail, it is not shown again.
export function ScopeTrail({ envID, tail }: { envID: number | null | undefined; tail?: ReactNode }) {
  const { t } = useTranslation();
  const scopes = useQuery({ queryKey: ["scopes"], queryFn: listScopes });
  useShowScope(envID);
  const byID = new Map((scopes.data ?? []).map((s) => [s.id, s]));
  const chain: Scope[] = [];
  for (let x = envID ? byID.get(envID) : undefined; x; x = x.parent_id ? byID.get(x.parent_id) : undefined) chain.unshift(x);
  if (scopes.isPending) return null;
  const parts: ReactNode[] = chain.map((s) => (
    <Link key={s.id} to="/scopes/$id" params={{ id: String(s.id) }} className="hover:text-foreground hover:underline">
      {s.name}
    </Link>
  ));
  if (chain.length === 0 && envID !== undefined) parts.push(<span key="none">{t("overview.unassigned")}</span>);
  if (tail) parts.push(tail);
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 md:hidden">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-muted-foreground/50">/</span>}
          {p}
        </Fragment>
      ))}
    </span>
  );
}
