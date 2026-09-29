"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Btn, Card, Icon, PageHead, StatusDot } from "./ui";

export type EventView = { id: string; title: string; startsAt: string; endsAt: string; calendar: string | null; source: string | null; status: string | null };
type Group = { label: string; events: EventView[] };

export default function CalendarBoard({ groups }: { groups: Group[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [requested, setRequested] = useState<string | null>(null);
  const router = useRouter();

  const cancel = async (ev: EventView) => {
    setBusy(ev.id);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", toolId: "calendar.delete", params: { id: ev.id }, reason: `You cancelled “${ev.title}” from the Calendar page.` }),
      });
      const out = await res.json();
      if (out.ok) {
        setRequested(ev.id);
        router.refresh();
      }
    } finally { setBusy(null); }
  };

  return (
    <div>
      <PageHead
        title="Assistant Calendar"
        sub="Synced from Google Calendar (demo). Creating or cancelling any event requires approval — Orbit never commits silently."
        right={<Badge tone="warn">Demo sync · read + approved writes</Badge>}
      />
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{g.label}</div>
            <div className="space-y-1.5">
              {g.events.map((e) => {
                const s = new Date(e.startsAt);
                const en = new Date(e.endsAt);
                const time = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }).replace(" ", "");
                const cancelled = e.status === "cancelled";
                return (
                  <Card key={e.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${cancelled ? "opacity-50" : ""}`}>
                    <div className="w-[110px] shrink-0">
                      <div className="font-mono text-[13px] text-ink">{time(s)}–{time(en)}</div>
                      <div className="text-[10.5px] text-faint">{e.calendar} · {e.source}</div>
                    </div>
                    <StatusDot tone={cancelled ? "danger" : "ok"} pulse={!cancelled && g.label === "Today"} />
                    <span className={`text-[13.5px] ${cancelled ? "line-through" : "text-ink"}`}>{e.title}</span>
                    <div className="ml-auto flex items-center gap-2">
                      {cancelled && <Badge tone="danger">cancelled</Badge>}
                      {requested === e.id && (
                        <span className="flex items-center gap-1.5 text-[11.5px] text-warn">
                          <StatusDot tone="warn" pulse /> <Link href="/approvals" className="underline">approval requested →</Link>
                        </span>
                      )}
                      {!cancelled && requested !== e.id && (
                        <Btn size="sm" variant="danger" disabled={busy === e.id} onClick={() => void cancel(e)}>Cancel event</Btn>
                      )}
                    </div>
                  </Card>
                );
              })}
              {g.events.length === 0 && <div className="rounded-xl border border-dashed border-line px-4 py-3 text-[12px] text-faint">Nothing scheduled.</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 text-[11.5px] text-faint">
        <Icon name="approvals" size={12} />
        Cancellation is a HIGH-risk tool (<span className="font-mono">calendar.delete</span>) — it goes through the policy engine, appears in Approvals, and is verified before the UI updates.
      </div>
    </div>
  );
}
