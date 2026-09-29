"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./ui";

export default function ApplyJobButton({
  jobId,
  role,
  company,
}: {
  jobId: string;
  role: string;
  company: string;
}) {
  const [status, setStatus] = useState<"idle" | "applying" | "applied">("idle");
  const router = useRouter();

  async function handleApply() {
    if (status !== "idle") return;
    setStatus("applying");
    try {
      const res = await fetch("/api/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "job.apply",
          id: jobId,
          role,
          company,
        }),
      });
      if (res.ok) {
        setStatus("applied");
        router.refresh();
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("idle");
    }
  }

  if (status === "applied") {
    return (
      <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-ok/15 px-2 py-0.5 text-[11.5px] font-medium text-ok">
        <Icon name="check" size={12} /> Applied in background
      </span>
    );
  }

  return (
    <button
      onClick={handleApply}
      disabled={status === "applying"}
      className="ml-auto flex items-center gap-1 text-[12px] font-medium text-accent transition hover:text-accent/80 hover:underline disabled:opacity-50"
    >
      {status === "applying" ? (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent" />
          Applying in background...
        </>
      ) : (
        <>
          Apply via Orbit <Icon name="orbit" size={12} />
        </>
      )}
    </button>
  );
}
