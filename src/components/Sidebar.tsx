"use client";

import Link from "next/link";
import ResetDemoButton from "@/components/ResetDemoButton";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";

const GROUPS: { label: string; items: { href: string; icon: string; label: string }[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/", icon: "home", label: "Home" },
      { href: "/tasks", icon: "tasks", label: "Tasks" },
      { href: "/goals", icon: "goals", label: "Goals" },
      { href: "/calendar", icon: "calendar", label: "Calendar" },
      { href: "/expenses", icon: "expenses", label: "Expenses" },
    ],
  },
  {
    label: "Agent",
    items: [
      { href: "/approvals", icon: "approvals", label: "Approvals" },
      { href: "/activity", icon: "activity", label: "Activity" },
      { href: "/automations", icon: "automations", label: "Automations" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/connectors", icon: "connectors", label: "Connectors" },
      { href: "/skills", icon: "skills", label: "Skills" },
      { href: "/mcp", icon: "mcp", label: "MCP" },
      { href: "/plugins", icon: "plugins", label: "Plugins" },
    ],
  },
  {
    label: "Control",
    items: [
      { href: "/jobs", icon: "jobs", label: "Jobs" },
      { href: "/security", icon: "security", label: "Security" },
      { href: "/profile", icon: "profile", label: "Profile" },
    ],
  },
];

export default function Sidebar({ approvals, notifications }: { approvals: number; notifications: number }) {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r border-line bg-surface/60 backdrop-blur-sm md:flex">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-accent/30 bg-accent-soft text-accent">
          <Icon name="orbit" size={20} />
        </div>
        <div>
          <div className="font-display text-[15px] font-semibold tracking-tight text-ink">ORBIT <span className="text-accent">AI</span></div>
          <div className="text-[10px] text-faint">Give it a goal. Stay in control.</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g) => (
          <div key={g.label} className="mt-3 first:mt-1">
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint/80">{g.label}</div>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors ${
                      active ? "bg-accent-soft text-ink" : "text-muted hover:bg-white/[0.04] hover:text-ink"
                    }`}
                  >
                    <span className={active ? "text-accent" : "text-faint group-hover:text-muted"}>
                      <Icon name={it.icon} size={15} />
                    </span>
                    {it.label}
                    {it.href === "/approvals" && approvals > 0 && (
                      <span className="ml-auto rounded-md bg-warn/15 px-1.5 py-px text-[10px] font-semibold text-warn">{approvals}</span>
                    )}
                    {it.href === "/activity" && notifications > 0 && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-info" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-4 py-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-warn">
            <span className="h-1.5 w-1.5 rounded-full bg-warn pulse-warn" /> Demo mode
          </div>
          <ResetDemoButton variant="compact" />
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">A</span>
          Aarav · COET Coimbatore
        </div>
      </div>
    </aside>
  );
}
