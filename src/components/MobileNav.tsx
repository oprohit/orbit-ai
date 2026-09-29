"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";

const ITEMS = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/tasks", icon: "tasks", label: "Tasks" },
  { href: "/goals", icon: "goals", label: "Goals" },
  { href: "/approvals", icon: "approvals", label: "Approvals" },
  { href: "/profile", icon: "profile", label: "Profile" },
];

export default function MobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 backdrop-blur md:hidden">
      {ITEMS.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${active ? "text-accent" : "text-faint"}`}>
            <Icon name={it.icon} size={18} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
