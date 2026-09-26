import { BookOpen, Briefcase, Compass, Flag, GitBranch, Handshake, Home, Landmark, LogOut, Menu, Network, NotebookPen, RotateCcw, Search, Settings, Shield, Ship, Sunrise, Trophy, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth";
import { useMe } from "@/lib/queries";
import { cx, Spinner } from "./ui";

const NAV = [
  { to: "/app", label: "Command Center", icon: Home, end: true, mobile: true },
  { to: "/app/train", label: "Train", icon: Compass, end: false, mobile: true },
  { to: "/app/inference", label: "Inference Lab", icon: Search, end: false, mobile: true },
  { to: "/app/simulations", label: "Simulations", icon: Landmark, end: false, mobile: false },
  { to: "/app/trees", label: "Scenario Trees", icon: GitBranch, end: false, mobile: false },
  { to: "/app/war-room", label: "War Room", icon: Users, end: false, mobile: false },
  { to: "/app/library", label: "Library", icon: BookOpen, end: false, mobile: false },
  { to: "/app/knowledge", label: "Knowledge", icon: Network, end: false, mobile: false },
  { to: "/app/review", label: "Review", icon: RotateCcw, end: false, mobile: false },
  { to: "/app/briefing", label: "Daily briefing", icon: Sunrise, end: false, mobile: false },
  { to: "/app/projects", label: "Strategy Lab", icon: Briefcase, end: false, mobile: false },
  { to: "/app/journal", label: "Decision journal", icon: NotebookPen, end: false, mobile: false },
  { to: "/app/missions", label: "Missions", icon: Flag, end: false, mobile: false },
  { to: "/app/negotiations", label: "Negotiations", icon: Handshake, end: false, mobile: false },
  { to: "/app/game", label: "Management game", icon: Ship, end: false, mobile: false },
  { to: "/app/challenges", label: "Monthly challenge", icon: Trophy, end: false, mobile: false },
  { to: "/app/profile", label: "Progress", icon: UserRound, end: false, mobile: true },
  { to: "/app/settings", label: "Settings", icon: Settings, end: false, mobile: false },
];
const MOBILE_NAV = NAV.filter((n) => n.mobile);

/** Authenticated layout: sidebar on desktop, bottom tabs on phones. */
export function AppShell() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [moreOpen, setMoreOpen] = useState(false);

  const onSignOut = async () => {
    await signOut();
    qc.clear();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-bg-elevated md:flex">
        <div className="px-5 py-5">
          <div className="font-serif text-xl">Lunara</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-text-faint">Strategy Lab</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {[...NAV, ...(me.data?.profile.roles.admin ? [{ to: "/app/admin", label: "Administration", icon: Shield, end: false, mobile: false }] : [])].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-accent-soft text-accent font-medium" : "text-text-muted hover:bg-surface-muted hover:text-text",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border px-3 py-3">
          <div className="truncate px-3 text-xs text-text-faint">{me.data?.profile.email ?? ""}</div>
          <button onClick={onSignOut} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <div className="font-serif text-lg">Lunara</div>
          <div className="relative flex items-center gap-1">
            <button onClick={() => setMoreOpen((o) => !o)} aria-label="More sections" aria-expanded={moreOpen} className="rounded-lg p-2 text-text-muted hover:bg-surface-muted">
              <Menu className="h-4 w-4" />
            </button>
            {moreOpen ? (
              <div className="absolute right-0 top-10 z-30 w-52 rounded-lg border border-border bg-surface p-1 shadow-panel">
                {NAV.filter((n) => !n.mobile).map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={() => setMoreOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text">
                    <item.icon className="h-4 w-4" /> {item.label}
                  </NavLink>
                ))}
                <button onClick={onSignOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="safe-bottom mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {me.isPending ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-bg-elevated pb-[env(safe-area-inset-bottom)] md:hidden">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cx("flex flex-col items-center gap-1 py-2 text-[11px]", isActive ? "text-accent" : "text-text-faint")
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label.split(" ")[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
