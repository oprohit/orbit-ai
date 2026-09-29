import Link from "next/link";

/* next/link default import used by NavPill */

const PATHS: Record<string, React.ReactNode> = {
  home: (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.75V21h14V9.75" /></>),
  tasks: (<><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m8.5 12 2.5 2.5 5-5" /></>),
  goals: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 3v4M16 3v4" /></>),
  expenses: (<><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10.5h18M7 15h4" /></>),
  approvals: (<><path d="M12 3l8 3v5.5c0 4.8-3.4 7.6-8 9.5-4.6-1.9-8-4.7-8-9.5V6z" /><path d="m8.8 12 2.2 2.2 4.2-4.2" /></>),
  activity: <path d="M3 12h4l2.5-7 4.5 14 2.5-7H21" />,
  connectors: (<><path d="M9 7V3M15 7V3" /><path d="M7 7h10v4.5a5 5 0 0 1-10 0z" /><path d="M12 16.5V21" /></>),
  skills: (<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="m18.5 15.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>),
  mcp: (<><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>),
  plugins: (<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><circle cx="16.5" cy="16.5" r="3" /></>),
  automations: (<><path d="m17 2 4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>),
  jobs: (<><rect x="3" y="8" width="18" height="12" rx="2.5" /><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>),
  security: (<><rect x="5" y="11" width="14" height="9.5" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  profile: (<><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.6-4 3.7-6 7.5-6s6.9 2 7.5 6" /></>),
  send: (<><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  bell: (<><path d="M6 9.5a6 6 0 1 1 12 0c0 4.8 2 6 2 6H4s2-1.2 2-6" /><path d="M10 19.5a2 2 0 0 0 4 0" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>),
  file: (<><path d="M6 3h8l4 4.5V21H6z" /><path d="M14 3v5h4" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3 8 9 6 9-6" /></>),
  external: (<><path d="M14 4h6v6" /><path d="M20 4 10.5 13.5" /><path d="M18 13.5V20H4V6h6.5" /></>),
  orbit: (<><circle cx="12" cy="12" r="3.2" /><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-22 12 12)" /><circle cx="20.4" cy="7.6" r="1.1" fill="currentColor" /></>),
};

export function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

const TONES: Record<string, string> = {
  ok: "bg-ok/12 text-ok border-ok/25",
  warn: "bg-warn/12 text-warn border-warn/25",
  danger: "bg-danger/12 text-danger border-danger/25",
  info: "bg-info/12 text-info border-info/25",
  accent: "bg-accent-soft text-accent border-accent/25",
  muted: "bg-white/5 text-muted border-line",
};

export function Badge({ tone = "muted", children, className = "" }: { tone?: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-[2px] text-[10px] font-medium uppercase tracking-wider ${TONES[tone] ?? TONES.muted} ${className}`}>
      {children}
    </span>
  );
}

export const RISK_TONE: Record<string, string> = { low: "ok", medium: "info", high: "warn", critical: "danger" };
export const riskTone = (r?: string | null) => RISK_TONE[r ?? "low"] ?? "muted";

export function RiskBadge({ risk }: { risk?: string | null }) {
  return <Badge tone={riskTone(risk)}>{risk ?? "—"}</Badge>;
}

export function StatusDot({ tone = "ok", pulse = false }: { tone?: string; pulse?: boolean }) {
  const c: Record<string, string> = { ok: "bg-ok", warn: "bg-warn", danger: "bg-danger", info: "bg-info", faint: "bg-faint", accent: "bg-accent" };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${c[tone] ?? c.ok} ${pulse ? (tone === "ok" ? "pulse-ok" : "pulse-warn") : ""}`} />;
}

export function Card({ children, className = "", glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return <div className={`rounded-xl border border-line bg-surface ${glow ? "glow-soft" : ""} ${className}`}>{children}</div>;
}

export function Btn({
  children, onClick, variant = "ghost", size = "md", disabled = false, className = "", title,
}: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "ok"; size?: "sm" | "md"; disabled?: boolean; className?: string; title?: string;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap";
  const sizes = size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8.5 px-3.5 text-[13px]";
  const variants = {
    primary: "bg-accent text-white hover:brightness-110 glow-accent",
    ghost: "border border-line bg-white/[0.03] text-ink hover:bg-white/[0.07]",
    danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
    ok: "border border-ok/30 bg-ok/10 text-ok hover:bg-ok/20",
  };
  return (
    <button title={title} disabled={disabled} onClick={onClick} className={`${base} ${sizes} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Progress({ value, tone = "accent" }: { value: number; tone?: string }) {
  const bg: Record<string, string> = { accent: "bg-accent", ok: "bg-ok", warn: "bg-warn", danger: "bg-danger" };
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
      <div className={`h-full rounded-full transition-all duration-500 ${bg[tone] ?? bg.accent}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-[13px] text-faint">{text}</div>;
}

export function DemoTag({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border border-warn/25 bg-warn/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warn ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-warn pulse-warn" />
      Demo mode
    </span>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{children}</div>;
}

export function NavPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-2.5 py-1 text-[12px] transition-colors ${active ? "bg-accent-soft text-accent" : "text-muted hover:text-ink hover:bg-white/5"}`}
    >
      {children}
    </Link>
  );
}

export const fmtInr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
