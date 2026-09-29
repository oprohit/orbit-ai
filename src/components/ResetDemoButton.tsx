"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

export default function ResetDemoButton({
  variant = "compact",
}: {
  variant?: "compact" | "full";
}) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleReset() {
    try {
      setLoading(true);
      const res = await fetch("/api/reset-demo", { method: "POST" });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to reset demo.");
        setLoading(false);
        setConfirming(false);
      }
    } catch {
      alert("Network error while resetting demo.");
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleReset}
          disabled={loading}
          className="rounded-md bg-danger px-2 py-0.5 text-[11px] font-medium text-white transition hover:bg-danger/90 disabled:opacity-50"
        >
          {loading ? "Resetting..." : "Confirm Reset"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-md border border-line bg-card px-2 py-0.5 text-[11px] text-faint hover:text-ink"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={() => setConfirming(true)}
        title="Reset all demo data back to clean state"
        className="inline-flex items-center gap-1.5 rounded-lg border border-warn/30 bg-warn/10 px-2 py-1 text-[11px] font-medium text-warn transition hover:bg-warn/20"
      >
        <Icon name="refresh" size={12} className={loading ? "animate-spin" : ""} />
        <span>Reset demo</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title="Reset all demo data back to clean state"
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-warn/30 bg-warn/10 py-1.5 text-[11.5px] font-medium text-warn transition hover:bg-warn/20"
    >
      <Icon name="refresh" size={13} className={loading ? "animate-spin" : ""} />
      <span>Reset Demo Workspace</span>
    </button>
  );
}
