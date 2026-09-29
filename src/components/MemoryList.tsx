"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Btn } from "./ui";

export type MemoryView = { id: string; key: string; value: string; kind: string };

export default function MemoryList({ items }: { items: MemoryView[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const router = useRouter();

  const save = async (m: MemoryView) => {
    await fetch("/api/mutate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "memory", key: m.key, value: draft }) });
    setEditing(null);
    router.refresh();
  };
  const del = async (id: string) => {
    await fetch("/api/mutate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "memory.delete", id }) });
    router.refresh();
  };

  return (
    <div className="space-y-1.5">
      {items.map((m) => (
        <div key={m.id} className="rounded-lg border border-line bg-bg px-3 py-2">
          <div className="flex items-center gap-2">
            <code className="font-mono text-[11px] text-info">{m.key}</code>
            <Badge tone="muted" className="ml-auto">{m.kind}</Badge>
            <button className="text-[11px] text-faint hover:text-ink" onClick={() => { setEditing(editing === m.id ? null : m.id); setDraft(m.value); }}>Edit</button>
            <button className="text-[11px] text-faint hover:text-danger" onClick={() => void del(m.id)}>Delete</button>
          </div>
          {editing === m.id ? (
            <div className="mt-1.5 flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-7 flex-1 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink" />
              <Btn size="sm" variant="primary" onClick={() => void save(m)}>Save</Btn>
            </div>
          ) : (
            <div className="mt-0.5 text-[12.5px] text-muted">{m.value}</div>
          )}
        </div>
      ))}
      {items.length === 0 && <div className="text-[12px] text-faint">No stored memories. Tell Orbit your preferences and it will remember (only what it's allowed to store).</div>}
    </div>
  );
}
