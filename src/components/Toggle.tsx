"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Toggle({
  action, id, enabled, label,
}: { action: string; id: string; enabled: boolean; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const router = useRouter();
  return (
    <div className="flex items-center gap-1.5">
      {pendingApproval && (
        <span className="text-[10px] font-medium text-warn animate-pulse">Approval waiting</span>
      )}
      <button
        aria-label={label ?? "toggle"}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/mutate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, id, enabled: !enabled, status: enabled ? "disabled" : "enabled" }),
            });
            const data = await res.json();
            if (data?.approvalRequired) {
              setPendingApproval(true);
            }
            router.refresh();
          } finally { setBusy(false); }
        }}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${enabled ? "bg-accent" : "bg-white/10"}`}
        title={pendingApproval ? "Approval pending in Approvals tab" : (label ?? "toggle")}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${enabled ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
