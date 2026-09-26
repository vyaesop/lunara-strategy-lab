import { BookOpen, Briefcase, Compass, Flag, GitBranch, Handshake, Home, Landmark, LogOut, Menu, Network, NotebookPen, RotateCcw, Search, Settings, Shield, Ship, Sunrise, Trophy, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth";
import { EASE, gsap, useGSAP } from "@/lib/motion";
import { useMe } from "@/lib/queries";
import { PageTransition } from "./motion";
import { SmoothScroll } from "./smooth-scroll";
import { cx, Spinner } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  mobile?: boolean;
}

const GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Practice",
    items: [
      { to: "/app", label: "Command Center", icon: Home, end: true, mobile: true },
      { to: "/app/briefing", label: "Daily briefing", icon: Sunrise },
      { to: "/app/train", label: "Train", icon: Compass, mobile: true },
      { to: "/app/inference", label: "Inference Lab", icon: Search, mobile: true },
      { to: "/app/review", label: "Review", icon: RotateCcw },
    ],
  },
  {
    label: "Strategy",
    items: [
      { to: "/app/simulations", label: "Simulations", icon: Landmark },
      { to: "/app/trees", label: "Scenario Trees", icon: GitBranch },
      { to: "/app/war-room", label: "War Room", icon: Users },
      { to: "/app/negotiations", label: "Negotiations", icon: Handshake },
      { to: "/app/game", label: "Management game", icon: Ship },
      { to: "/app/challenges", label: "Monthly challenge", icon: Trophy },
    ],
  },
  {
    label: "Your work",
    items: [
      { to: "/app/projects", label: "Strategy Lab", icon: Briefcase },
      { to: "/app/journal", label: "Decision journal", icon: NotebookPen },
      { to: "/app/missions", label: "Missions", icon: Flag },
      { to: "/app/library", label: "Library", icon: BookOpen },
      { to: "/app/knowledge", label: "Knowledge", icon: Network },
    ],
  },
  {
    label: "You",
    items: [
      { to: "/app/profile", label: "Progress", icon: UserRound, mobile: true },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);
const MOBILE_NAV = ALL.filter((n) => n.mobile);

function isActive(item: NavItem, pathname: string) {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/** Authenticated layout: sidebar on desktop, glass tab bar on phones. */
export function AppShell() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const groups = me.data?.profile.roles.admin ? [...GROUPS, { label: "Admin", items: [{ to: "/app/admin", label: "Administration", icon: Shield }] }] : GROUPS;

  const onSignOut = async () => {
    await signOut();
    qc.clear();
    navigate("/", { replace: true });
  };

  return (
    <SmoothScroll>
      <div className="relative flex min-h-full">
        <div className="ambient pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
        <div className="noise pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
        <Sidebar groups={groups} pathname={location.pathname} email={me.data?.profile.email ?? ""} onSignOut={onSignOut} />

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/75 px-4 py-3 backdrop-blur-xl md:hidden">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="font-serif text-lg">Lunara</span>
            </div>
            <button onClick={() => setMoreOpen(true)} aria-label="More sections" aria-expanded={moreOpen} className="rounded-lg p-2 text-text-muted hover:bg-surface-muted">
              <Menu className="h-5 w-5" />
            </button>
          </header>
          <MobileSheet open={moreOpen} onClose={() => setMoreOpen(false)} groups={groups} pathname={location.pathname} onSignOut={onSignOut} />
          <main className="safe-bottom mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-10 md:py-10">
            {me.isPending ? (
              <div className="flex justify-center py-20">
                <Spinner />
              </div>
            ) : (
              <PageTransition routeKey={location.pathname}>
                <Outlet />
              </PageTransition>
            )}
          </main>
        </div>

        <nav className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-4 rounded-2xl border border-border bg-bg-elevated/80 p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-panel backdrop-blur-xl md:hidden">
          {MOBILE_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive: a }) => cx("flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] transition-colors duration-300", a ? "bg-accent-soft text-accent" : "text-text-faint")}>
              <item.icon className="h-5 w-5" />
              {item.label.split(" ")[0]}
            </NavLink>
          ))}
        </nav>
      </div>
    </SmoothScroll>
  );
}

function Sidebar({ groups, pathname, email, onSignOut }: { groups: typeof GROUPS; pathname: string; email: string; onSignOut: () => void }) {
  const navRef = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  // The active pill glides to the current item instead of jumping.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = indicator.current;
    if (!nav || !pill) return;
    const active = nav.querySelector<HTMLElement>("[data-active='true']");
    if (!active) {
      gsap.to(pill, { opacity: 0, duration: 0.2 });
      return;
    }
    const y = active.offsetTop;
    const h = active.offsetHeight;
    if (first.current) {
      gsap.set(pill, { y, height: h, opacity: 1 });
      first.current = false;
    } else gsap.to(pill, { y, height: h, opacity: 1, duration: 0.55, ease: EASE.out });
  }, [pathname, groups.length]);

  useGSAP(
    () => {
      gsap.from(".nav-item", { x: -12, opacity: 0, duration: 0.5, stagger: 0.02, ease: EASE.out, clearProps: "transform,opacity" });
    },
    { scope: navRef },
  );

  return (
    <aside className="sticky top-0 z-10 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-bg-elevated/70 backdrop-blur-xl md:flex">
      <NavLink to="/app" className="group flex items-center gap-3 px-6 pb-4 pt-6">
        <span className="grid h-9 w-9 place-items-center rounded-full border border-accent/50">
          <span className="h-2.5 w-2.5 rounded-full bg-accent transition-transform duration-500 group-hover:scale-150" />
        </span>
        <span>
          <span className="block font-serif text-xl leading-none">Lunara</span>
          <span className="block text-[10px] uppercase tracking-[0.24em] text-text-faint">Strategy Lab</span>
        </span>
      </NavLink>
      <nav ref={navRef} data-lenis-prevent className="relative flex-1 overflow-y-auto px-3 pb-4">
        <span ref={indicator} className="absolute left-3 right-3 top-0 rounded-lg bg-accent-soft opacity-0" aria-hidden="true">
          <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />
        </span>
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <div className="nav-item px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-[0.22em] text-text-faint">{g.label}</div>
            {g.items.map((item) => {
              const active = isActive(item, pathname);
              return (
                <NavLink key={item.to} to={item.to} end={item.end} data-active={active} className={cx("nav-item relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-300", active ? "font-medium text-accent" : "text-text-muted hover:text-text")}>
                  <item.icon className={cx("h-4 w-4 transition-transform duration-300", active && "scale-110")} />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-border px-3 py-3">
        <div className="truncate px-3 text-xs text-text-faint">{email}</div>
        <button onClick={onSignOut} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}

function MobileSheet({ open, onClose, groups, pathname, onSignOut }: { open: boolean; onClose: () => void; groups: typeof GROUPS; pathname: string; onSignOut: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!ref.current) return;
      const panel = ref.current.querySelector(".sheet");
      const scrim = ref.current.querySelector(".scrim");
      if (open) {
        gsap.set(ref.current, { display: "block" });
        gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.3 });
        gsap.fromTo(panel, { yPercent: 100 }, { yPercent: 0, duration: 0.55, ease: EASE.out });
        gsap.from(ref.current.querySelectorAll(".sheet-item"), { y: 12, opacity: 0, stagger: 0.015, duration: 0.4, delay: 0.1, clearProps: "transform,opacity" });
      } else {
        gsap.to(scrim, { opacity: 0, duration: 0.25 });
        gsap.to(panel, { yPercent: 100, duration: 0.35, ease: "power3.in", onComplete: () => void gsap.set(ref.current, { display: "none" }) });
      }
    },
    { dependencies: [open], scope: ref },
  );
  return (
    <div ref={ref} className="fixed inset-0 z-40 hidden md:hidden" aria-hidden={!open}>
      <button className="scrim absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Close menu" tabIndex={open ? 0 : -1} />
      <div data-lenis-prevent className="sheet absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-border bg-bg-elevated p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="mx-auto h-1 w-10 rounded-full bg-border-strong" />
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-lg p-2 text-text-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <div className="sheet-item px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-text-faint">{g.label}</div>
            <div className="grid grid-cols-2 gap-1">
              {g.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose} className={cx("sheet-item flex items-center gap-2 rounded-xl px-3 py-3 text-sm", isActive(item, pathname) ? "bg-accent-soft text-accent" : "text-text-muted")}>
                  <item.icon className="h-4 w-4" /> {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
        <button onClick={onSignOut} className="sheet-item flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm text-text-muted">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
