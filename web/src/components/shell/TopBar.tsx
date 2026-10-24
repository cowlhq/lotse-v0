import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Check, ChevronsUpDown, LogOut, Monitor, Moon, Search, Settings, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { listScopes, logout, type Scope } from "@/api";
import { Account } from "@/components/Account";
import { useAlerts } from "@/components/Alerts";
import { Logo } from "@/components/Logo";
import { AddMenu } from "@/components/shell/AddMenu";
import { StatusIcon } from "@/components/shell/Dot";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { firing, levelUnder } from "@/lib/status";
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
      <Button variant="ghost" size="icon-sm" className={icon} aria-label={t("nav.alerts")} render={<Link to="/alerts" />}>
        <Bell />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-[10px] leading-4 font-semibold text-white tabular-nums" style={{ background: crit ? "var(--crit)" : "var(--warn)" }}>
            {count}
          </span>
        )}
      </Button>
      {!scoped && (
        <Button variant="ghost" size="icon-sm" className={`${icon} max-sm:hidden`} aria-label={t("nav.settings")} title={update ? t("nav.updateAvailable") : undefined} render={<Link to="/settings" />}>
          <Settings />
          {update && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-brand" />}
        </Button>
      )}
      {isAdmin && (
        <>
          <div className="hidden sm:block">
            <AddMenu />
          </div>
          <div className="sm:hidden">
            <AddMenu compact />
          </div>
        </>
      )}
      <UserMenu />
    </header>
  );
}

// ScopeSwitcher says where one is, as a trail: Acme / Shop / Production.
// Each step leads to its page, and its arrows open the others on the same
// level, to go there instead. After the last step, the level below can be
// chosen; with nothing chosen, the trail is "All customers". On a phone only
// the last step shows.
function ScopeSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const alerts = useAlerts().data ?? [];
  const scopes = useQuery({ queryKey: ["scopes"], queryFn: listScopes });
  const current = useCurrentScope();
  const all = scopes.data ?? [];
  const byID = new Map(all.map((s) => [s.id, s]));
  const ids = new Set(all.map((s) => s.id));
  const byName = (a: Scope, b: Scope) => a.name.localeCompare(b.name);
  // The top is the customers; for a user kept to a project or an
  // environment, that.
  const roots = all.filter((s) => s.parent_id == null || !ids.has(s.parent_id)).sort(byName);
  const chosen = current != null ? byID.get(current) : undefined;
  const trail = chosen ? chain(chosen, byID, ids) : [];
  const childrenOf = (s: Scope) => all.filter((x) => x.parent_id === s.id).sort(byName);
  const everything = (list: Scope[]) => (list[0]?.kind === "project" ? t("nav.allProjects") : list[0]?.kind === "environment" ? t("nav.allEnvironments") : t("nav.allCustomers"));
  const below = chosen ? childrenOf(chosen) : [];

  // menu lists the scopes of one level, and above them "All …", which leads
  // to the level above (home for the customers).
  const menu = (list: Scope[], up: () => void, at?: number) => (
    <DropdownMenuContent align="start" className="max-h-96 w-60 overflow-y-auto">
      <DropdownMenuItem onClick={up}>
        <span className="flex-1">{everything(list)}</span>
        {at == null && <Check className="text-muted-foreground" />}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {list.map((s) => (
        <DropdownMenuItem key={s.id} onClick={() => navigate({ to: "/scopes/$id", params: { id: String(s.id) } })}>
          <StatusIcon level={levelUnder(alerts, s.path)} size={12} />
          <span className="flex-1 truncate">{s.name}</span>
          {at === s.id && <Check className="text-muted-foreground" />}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
  const goTo = (s?: Scope) => () => (s ? navigate({ to: "/scopes/$id", params: { id: String(s.id) } }) : navigate({ to: "/" }));
  const slash = <span className="text-muted-foreground/40 select-none">/</span>;

  return (
    <nav className="flex min-w-0 items-center gap-1" aria-label={t("nav.where")}>
      {trail.length === 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-1.5 px-2 font-medium" />}>
            {everything(roots)}
            <ChevronsUpDown className="text-muted-foreground" />
          </DropdownMenuTrigger>
          {menu(roots, goTo())}
        </DropdownMenu>
      )}
      {trail.map((s, i) => {
        const parent = i > 0 ? trail[i - 1] : undefined;
        const level = parent ? childrenOf(parent) : roots;
        const last = i === trail.length - 1;
        return (
          <span key={s.id} className={`flex min-w-0 items-center gap-1 ${last ? "" : "max-sm:hidden"}`}>
            {i > 0 && <span className="max-sm:hidden">{slash}</span>}
            <span className="flex min-w-0 items-center rounded-md transition-colors hover:bg-accent">
              <Link to="/scopes/$id" params={{ id: String(s.id) }} className="flex min-w-0 items-center gap-1.5 py-1 pr-0.5 pl-2 font-medium">
                <StatusIcon level={levelUnder(alerts, s.path)} size={12} />
                <span className="max-w-40 truncate">{s.name}</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger aria-label={t("nav.switch")} className="flex h-7 items-center rounded-md px-1 text-muted-foreground hover:text-foreground">
                  <ChevronsUpDown className="size-3.5" />
                </DropdownMenuTrigger>
                {menu(level, goTo(parent), s.id)}
              </DropdownMenu>
            </span>
          </span>
        );
      })}
      {chosen && below.length > 0 && (
        <span className="flex items-center gap-1 max-sm:hidden">
          {slash}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-1.5 px-2 font-normal text-muted-foreground" />}>
              {everything(below)}
              <ChevronsUpDown />
            </DropdownMenuTrigger>
            {menu(below, goTo(chosen))}
          </DropdownMenu>
        </span>
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
