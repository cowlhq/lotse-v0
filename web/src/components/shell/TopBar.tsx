import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, LogOut, Monitor, Moon, Search, Settings, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { listChecks, listHosts, listScopes, logout, type Scope } from "@/api";
import { Account } from "@/components/Account";
import { useAlerts } from "@/components/Alerts";
import { Logo } from "@/components/Logo";
import { AddThing } from "@/components/AddThing";
import { StatusIcon } from "@/components/shell/Dot";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { firing, levelUnder, type Level } from "@/lib/status";
import { thingPath, things } from "@/lib/things";
import { useMe } from "@/lib/useMe";
import { useUpdates } from "@/lib/useUpdates";
import { newer } from "@/lib/version";

const icon = "relative text-muted-foreground hover:text-foreground";

// TopBar is the way around, in one line: home, which customer one looks
// at, search, the alerts, the settings, adding something, and oneself.
export function TopBar({ onSearch }: { onSearch: () => void }) {
  const { t } = useTranslation();
  const alerts = useAlerts().data ?? [];
  const count = firing(alerts).length;
  const crit = alerts.some((a) => a.state === "crit");
  const { isAdmin, scoped } = useMe();
  const { updates } = useUpdates();
  const update = updates && newer(updates.latest?.version, updates.hub_version);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1.5 border-b bg-background px-3 sm:gap-3 md:px-6">
      {/* On a phone only the flag, so that everything fits. */}
      <Wordmark className="h-[22px] sm:hidden" mark />
      <Wordmark className="hidden h-[22px] sm:block" />
      <ScopeSwitcher />
      <button
        type="button"
        onClick={onSearch}
        className="hidden h-8 w-56 items-center gap-2 rounded-md border bg-background px-2.5 text-muted-foreground shadow-xs transition-colors hover:text-foreground lg:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">{t("nav.search")}</span>
        <Kbd className="text-[11px]">⌘K</Kbd>
      </button>
      <div className="flex-1" />
      <Button variant="ghost" size="icon-sm" className={`${icon} lg:hidden`} aria-label={t("nav.search")} onClick={onSearch}>
        <Search />
      </Button>
      <Button variant="ghost" size="icon-sm" className={icon} aria-label={t("nav.alerts")} nativeButton={false} render={<Link to="/alerts" />}>
        <Bell />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-[10px] leading-4 font-semibold text-white tabular-nums" style={{ background: crit ? "var(--crit)" : "var(--warn)" }}>
            {count}
          </span>
        )}
      </Button>
      {!scoped && (
        <Button variant="ghost" size="icon-sm" className={`${icon} max-sm:hidden`} aria-label={t("nav.settings")} title={update ? t("nav.updateAvailable") : undefined} nativeButton={false} render={<Link to="/settings" />}>
          <Settings />
          {update && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-brand" />}
        </Button>
      )}
      {isAdmin && (
        <>
          <div className="hidden sm:block">
            <AddThing />
          </div>
          <div className="sm:hidden">
            <AddThing compact />
          </div>
        </>
      )}
      <UserMenu />
    </header>
  );
}

// ScopeSwitcher says where one is, as a short trail: the customer, and
// the thing whose page is open (decision 0027). Projects and environments
// are no levels of their own; only on a project's page does it stand in
// the middle. A click on a step opens the others of its kind, and the way
// up. On a phone only the last step shows.
function ScopeSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const alerts = useAlerts().data ?? [];
  const scopes = useQuery({ queryKey: ["scopes"], queryFn: listScopes });
  const hosts = useQuery({ queryKey: ["hosts"], queryFn: listHosts });
  const checks = useQuery({ queryKey: ["checks", "all"], queryFn: () => listChecks() });
  const current = useCurrentScope();
  const all = scopes.data ?? [];
  const byID = new Map(all.map((s) => [s.id, s]));
  const ids = new Set(all.map((s) => s.id));
  const byName = (a: Scope, b: Scope) => a.name.localeCompare(b.name);
  // The top is the customers; for a user kept to a project, that.
  const roots = all.filter((s) => s.parent_id == null || !ids.has(s.parent_id)).sort(byName);
  const chosen = current != null ? byID.get(current) : undefined;
  const root = chosen ? chain(chosen, byID, ids)[0] : undefined;
  const list = things(hosts.data ?? [], checks.data ?? [], alerts, all);
  const pathOf = new Map(all.map((s) => [s.id, s.path]));
  const mine = root ? list.filter((x) => {
    const p = x.envID ? pathOf.get(x.envID) : undefined;
    return p !== undefined && (p === root.path || p.startsWith(root.path + "/"));
  }) : [];
  const host = /^\/hosts\/(\d+)/.exec(path);
  const check = /^\/checks\/(\d+)/.exec(path);
  const thing = host ? list.find((x) => x.kind === "server" && x.id === Number(host[1])) : check ? list.find((x) => x.kind !== "server" && x.id === Number(check[1])) : undefined;
  // On a project's or environment's own page, it stands in the middle.
  const group = !thing && chosen && chosen.id !== root?.id ? chosen : undefined;
  const groups = root ? all.filter((s) => s.parent_id === root.id).sort(byName) : [];
  const everyone = roots[0]?.kind === "project" ? t("nav.allProjects") : t("nav.allCustomers");

  // The one open is in bold, as in a list of where one can go.
  const item = (key: string | number, level: Level, label: string, onClick: () => void, on: boolean, extra?: string) => (
    <DropdownMenuItem key={key} onClick={onClick} className={on ? "font-medium text-foreground" : "text-foreground/80"}>
      <StatusIcon level={level} size={12} />
      <span className="flex-1 truncate">{label}</span>
      {extra && <span className="text-mini text-muted-foreground">{extra}</span>}
    </DropdownMenuItem>
  );
  const top = (label: string, onClick: () => void, on: boolean) => (
    <>
      <DropdownMenuItem onClick={onClick} className={on ? "font-medium text-foreground" : "text-foreground/80"}>
        {label}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  );
  const toScope = (s: Scope) => () => navigate({ to: "/scopes/$id", params: { id: String(s.id) } });
  // step is one place in the trail; a click opens the others of its kind,
  // and the first line of that leads up.
  const step = (label: string, level: Level | null, menu: React.ReactNode, last: boolean, muted = false) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex max-w-56 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 whitespace-nowrap transition-colors hover:bg-accent data-popup-open:bg-accent ${muted ? "text-muted-foreground" : "font-medium text-foreground"} ${last ? "" : "max-sm:hidden"}`}
      >
        {level && <StatusIcon level={level} size={12} />}
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-auto min-w-60 max-w-80">
        {menu}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const slash = <span className="text-muted-foreground/40 select-none max-sm:hidden">/</span>;
  const customerMenu = (
    <>
      {top(everyone, () => navigate({ to: "/" }), !root)}
      {roots.map((r) => item(r.id, levelUnder(alerts, r.path), r.name, toScope(r), r.id === root?.id))}
    </>
  );
  const thingMenu = root && (
    <>
      {top(t("nav.allThings", { name: root.name }), toScope(root), !thing)}
      {mine.map((x) => item(x.key, x.level, x.name, () => navigate(thingPath(x)), x.key === thing?.key, t(`thing.kind.${x.kind}`)))}
    </>
  );

  return (
    <nav className="flex min-w-0 items-center gap-1" aria-label={t("nav.where")}>
      {step(root ? root.name : everyone, root ? levelUnder(alerts, root.path) : null, customerMenu, !root || (!thing && !group && mine.length === 0), !root)}
      {group && root && (
        <>
          {slash}
          {step(group.name, levelUnder(alerts, group.path), (
            <>
              {top(t("nav.allThings", { name: root.name }), toScope(root), false)}
              {groups.map((g) => item(g.id, levelUnder(alerts, g.path), g.name, toScope(g), g.id === group.id))}
            </>
          ), true)}
        </>
      )}
      {root && !group && (mine.length > 0 || thing) && (
        <>
          {slash}
          {thing ? step(thing.name, thing.level, thingMenu, true) : step(t("nav.things"), null, thingMenu, false, true)}
        </>
      )}
    </nav>
  );
}

// The scope one looks at is the one whose page is open, or the one a page
// of what is in it names (useShowScope), and stays so until one goes home.
function useCurrentScope(): number | null {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { hint } = useContext(ScopeHint);
  const [last, setLast] = useState<number | null>(null);
  const m = path.match(/^\/scopes\/(\d+)/);
  const home = path === "/" || path === "/alerts" || path.startsWith("/settings");
  const current = m ? Number(m[1]) : hint ?? (home ? null : last);
  if (current !== last) setLast(current);
  return current;
}

const ScopeHint = createContext<{ hint: number | null; setHint: (id: number | null) => void }>({ hint: null, setHint: () => {} });

// ScopeHintProvider lets a page tell the bar whose it is.
export function ScopeHintProvider({ children }: { children: ReactNode }) {
  const [hint, setHint] = useState<number | null>(null);
  return <ScopeHint.Provider value={{ hint, setHint }}>{children}</ScopeHint.Provider>;
}

// useShowScope tells the bar that the page open is of what is in a scope,
// such as a host in its environment.
export function useShowScope(id: number | null | undefined) {
  const { setHint } = useContext(ScopeHint);
  useEffect(() => {
    setHint(id ?? null);
    return () => setHint(null);
  }, [id, setHint]);
}

function chain(s: Scope, byID: Map<number, Scope>, ids: Set<number>): Scope[] {
  const out = [s];
  for (let x = s; x.parent_id != null && ids.has(x.parent_id); ) {
    x = byID.get(x.parent_id)!;
    out.unshift(x);
  }
  return out;
}

function UserMenu() {
  const { t } = useTranslation();
  const { user: me, scoped } = useMe();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const client = useQueryClient();
  const out = useMutation({ mutationFn: logout, onSuccess: () => client.invalidateQueries({ queryKey: ["me"] }) });
  const name = me?.name || me?.email || "";
  const [account, setAccount] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={name}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-mini font-semibold text-foreground ring-1 ring-border transition-colors hover:bg-accent"
        >
          {name.slice(0, 1).toUpperCase()}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* A label belongs in a group, or the menu does not open. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">
              <span className="block truncate font-medium text-foreground">{me?.name}</span>
              <span className="block truncate text-mini font-normal text-muted-foreground">{me?.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAccount(true)}>
            <UserRound />
            {t("account.title")}
          </DropdownMenuItem>
          {/* On a phone the settings have no room in the bar. */}
          {!scoped && (
            <DropdownMenuItem className="sm:hidden" onClick={() => navigate({ to: "/settings" })}>
              <Settings />
              {t("nav.settings")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(v) => setTheme(v as string)}>
            <DropdownMenuRadioItem value="system">
              <Monitor />
              {t("nav.themeSystem")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light">
              <Sun />
              {t("nav.themeLight")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon />
              {t("nav.themeDark")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => out.mutate()}>
            <LogOut />
            {t("login.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {me && <Account me={me} open={account} onOpenChange={setAccount} />}
    </>
  );
}

// Wordmark is lotse's logo, leading home.
export function Wordmark({ className = "h-[22px]", mark = false }: { className?: string; mark?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center text-foreground">
      <Logo className={`w-auto ${className}`} mark={mark} />
    </Link>
  );
}
