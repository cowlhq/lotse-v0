import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Check, ChevronsUpDown, LogOut, Monitor, Moon, Search, Settings, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
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

// ScopeSwitcher says whose things one looks at, all customers' or one's,
// and changes it. Under the customer one is in, its projects and
// environments can be chosen too.
function ScopeSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const alerts = useAlerts().data ?? [];
  const scopes = useQuery({ queryKey: ["scopes"], queryFn: listScopes });
  const current = useCurrentScope();
  const all = scopes.data ?? [];
  const byID = new Map(all.map((s) => [s.id, s]));
  const ids = new Set(all.map((s) => s.id));
  // The top is the customers; for a user kept to a project or an
  // environment, that.
  const roots = all.filter((s) => s.parent_id == null || !ids.has(s.parent_id)).sort((a, b) => a.name.localeCompare(b.name));
  const chosen = current != null ? byID.get(current) : undefined;
  const root = chosen && rootOf(chosen, byID, ids);
  const everything = roots.every((s) => s.kind === "customer") ? t("nav.allCustomers") : roots.every((s) => s.kind === "project") ? t("nav.allProjects") : t("nav.allEnvironments");
  const label = chosen ? chain(chosen, byID, ids).map((s) => s.name).join(" / ") : everything;
  const below = root ? all.filter((s) => s.path.startsWith(root.path + "/")).sort((a, b) => a.path.localeCompare(b.path)) : [];
  const item = (s: Scope, depth: number) => (
    <DropdownMenuItem key={s.id} onClick={() => navigate({ to: "/scopes/$id", params: { id: String(s.id) } })} style={{ paddingLeft: 8 + depth * 14 }}>
      <StatusIcon level={levelUnder(alerts, s.path)} size={12} />
      <span className="flex-1 truncate">{s.name}</span>
      {current === s.id && <Check className="text-muted-foreground" />}
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="min-w-0 max-w-36 justify-between gap-2 font-normal sm:max-w-72" />}>
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-64 overflow-y-auto">
        <DropdownMenuItem onClick={() => navigate({ to: "/" })}>
          <span className="flex-1">{everything}</span>
          {current == null && <Check className="text-muted-foreground" />}
        </DropdownMenuItem>
        {roots.length > 0 && <DropdownMenuSeparator />}
        {roots.map((r) => [item(r, 0), ...(root?.id === r.id ? below.map((s) => item(s, s.path.split("/").length - r.path.split("/").length)) : [])])}
        {roots.length === 0 && <p className="px-2 py-1.5 text-mini text-muted-foreground">{t("nav.noCustomers")}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The scope one looks at is the one whose page is open, and stays so on
// the pages of what is in it, until one goes home.
function useCurrentScope(): number | null {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [last, setLast] = useState<number | null>(null);
  const m = path.match(/^\/scopes\/(\d+)/);
  const home = path === "/" || path === "/alerts" || path.startsWith("/settings");
  const current = m ? Number(m[1]) : home ? null : last;
  if (current !== last) setLast(current);
  return current;
}

function rootOf(s: Scope, byID: Map<number, Scope>, ids: Set<number>): Scope {
  let x = s;
  while (x.parent_id != null && ids.has(x.parent_id)) x = byID.get(x.parent_id)!;
  return x;
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
