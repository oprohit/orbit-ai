"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge, Btn, Icon, StatusDot } from "./ui";

type WhatsAppStatusResponse = {
  running: boolean;
  connected: boolean;
  status: "disconnected" | "scan_needed" | "connecting" | "connected";
  user: { id?: string; name?: string } | null;
  qr: string;
  lastSync?: string | null;
  recentTasks?: { id: string; title: string; sender?: string; time?: string }[];
  source?: string;
};

export default function WhatsAppLinkModal({
  isOpen,
  onClose,
  onStatusChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (connected: boolean) => void;
}) {
  const [data, setData] = useState<WhatsAppStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [simText, setSimText] = useState("Hey Aarav, make sure to submit the Compiler Design assignment before 6 PM today!");
  const [simSender, setSimSender] = useState("Rahul (CR)");
  const [simSuccess, setSimSuccess] = useState<string | null>(null);
  const router = useRouter();

  // Poll status when modal is open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/whatsapp", { cache: "no-store" });
        if (res.ok && isMounted) {
          const json = await res.json();
          setData(json);
          if (onStatusChange) onStatusChange(json.connected);
        }
      } catch (e) {
        console.error("WhatsApp poll error:", e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, onStatusChange]);

  if (!isOpen) return null;

  const handleConnectSimulate = async () => {
    setActing(true);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      if (res.ok) {
        const json = await res.json();
        setData((prev) => (prev ? { ...prev, connected: true, status: "connected" } : null));
        if (onStatusChange) onStatusChange(true);
        router.refresh();
      }
    } finally {
      setActing(false);
    }
  };

  const handleDisconnect = async () => {
    setActing(true);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      if (res.ok) {
        setData((prev) => (prev ? { ...prev, connected: false, status: "scan_needed" } : null));
        if (onStatusChange) onStatusChange(false);
        router.refresh();
      }
    } finally {
      setActing(false);
    }
  };

  const handleSimulateMessage = async () => {
    setActing(true);
    setSimSuccess(null);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate", text: simText, sender: simSender }),
      });
      if (res.ok) {
        const out = await res.json();
        setSimSuccess(`Task created: "${out.task?.title || simText}" and added to Tasks Board!`);
        router.refresh();
      }
    } finally {
      setActing(false);
    }
  };

  const isConnected = data?.connected || data?.status === "connected";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border border-line bg-bg text-faint hover:text-ink hover:border-accent transition"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-[20px] shadow-sm">
            💬
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-ink">Link Personal WhatsApp</h2>
              <Badge tone={isConnected ? "ok" : "accent"}>
                {isConnected ? "Connected" : "QR Scan Ready"}
              </Badge>
            </div>
            <p className="text-[12px] text-muted">
              Scan with WhatsApp on your phone (Linked Devices). No WhatsApp Business API or Meta Cloud credentials needed.
            </p>
          </div>
        </div>

        {/* Modal Content */}
        {!isConnected ? (
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {/* Left: QR Code Box */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-bg p-5 text-center">
              <div className="relative overflow-hidden rounded-xl border-2 border-emerald-500/40 bg-white p-2 shadow-md">
                {data?.qr ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={data.qr}
                    alt="WhatsApp QR Code"
                    className="h-48 w-48 object-contain"
                  />
                ) : (
                  <div className="grid h-48 w-48 place-items-center text-black/50 text-[12px]">
                    Generating QR Code...
                  </div>
                )}
                {/* Scanning laser beam animation */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981] animate-pulse" />
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted">
                <StatusDot tone="ok" pulse />
                <span>Waiting for scan from your phone...</span>
              </div>

              <button
                onClick={handleConnectSimulate}
                disabled={acting}
                className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition"
              >
                {acting ? "Linking..." : "⚡ Quick Pair / Link Device"}
              </button>
            </div>

            {/* Right: Step-by-Step Instructions */}
            <div className="flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-[13px] font-semibold text-ink uppercase tracking-wider mb-2.5">
                  How to link on your phone:
                </h3>
                <ol className="space-y-2.5 text-[12.5px] text-muted leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-ink">
                      1
                    </span>
                    <span>Open <strong>WhatsApp</strong> on your phone.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-ink">
                      2
                    </span>
                    <span>Tap <strong>Settings</strong> (iOS) or <strong>Menu (⋮)</strong> (Android).</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-ink">
                      3
                    </span>
                    <span>Select <strong>Linked Devices</strong> and tap <strong>Link a Device</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-ink">
                      4
                    </span>
                    <span>Point your phone camera at this QR code to connect.</span>
                  </li>
                </ol>
              </div>

              {/* Safety & Intelligence Note */}
              <div className="rounded-xl border border-line bg-surface/70 p-3 text-[11.5px] text-faint space-y-1">
                <div className="font-semibold text-ink flex items-center gap-1.5">
                  <Icon name="security" size={12} className="text-emerald-400" />
                  <span>Smart NLP Task Extraction</span>
                </div>
                <p>
                  Orbit only converts messages that contain clear tasks (assignments, deadlines, requests). Everyday greetings and chit-chat are automatically filtered out.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Connected State */
          <div className="mt-5 space-y-5">
            {/* Connected Banner */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 text-[20px]">
                  ✓
                </span>
                <div>
                  <div className="text-[14px] font-semibold text-ink">
                    WhatsApp Device Linked Successfully
                  </div>
                  <div className="text-[12px] text-muted">
                    Connected as {data?.user?.name || "Personal WhatsApp"} ({data?.user?.id || "+91 98401 23456"})
                  </div>
                </div>
              </div>

              <Btn size="sm" variant="danger" disabled={acting} onClick={handleDisconnect}>
                Unlink Device
              </Btn>
            </div>

            {/* Real-time Task Monitor Features */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-bg p-3.5 space-y-1">
                <div className="flex items-center justify-between text-[12.5px] font-semibold text-ink">
                  <span>Task NLP Extractor</span>
                  <Badge tone="ok">Active</Badge>
                </div>
                <p className="text-[11.5px] text-muted">
                  Scans incoming messages for actionable requests, deadlines, and submissions.
                </p>
              </div>

              <div className="rounded-xl border border-line bg-bg p-3.5 space-y-1">
                <div className="flex items-center justify-between text-[12.5px] font-semibold text-ink">
                  <span>Chit-Chat Filter</span>
                  <Badge tone="ok">Ignoring</Badge>
                </div>
                <p className="text-[11.5px] text-muted">
                  Greetings, acknowledgments (&quot;ok&quot;, &quot;k&quot;, &quot;haha&quot;) and small talk are not added to tasks.
                </p>
              </div>
            </div>

            {/* Test Task Extraction Demo Simulator */}
            <div className="rounded-xl border border-line bg-bg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[12.5px] font-semibold text-ink">
                  Test Incoming WhatsApp Message Detection
                </h4>
                <span className="text-[11px] text-faint">Live Simulation</span>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={simSender}
                    onChange={(e) => setSimSender(e.target.value)}
                    placeholder="Sender Name"
                    className="w-1/3 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink"
                  />
                  <input
                    type="text"
                    value={simText}
                    onChange={(e) => setSimText(e.target.value)}
                    placeholder="WhatsApp message text..."
                    className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleSimulateMessage}
                    disabled={acting}
                    className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-1 text-[11.5px] font-semibold text-accent hover:bg-accent/20 transition"
                  >
                    {acting ? "Analyzing..." : "📨 Send Test Message & Detect Task"}
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      router.push("/tasks");
                    }}
                    className="text-[11.5px] text-accent hover:underline"
                  >
                    View in Tasks Board →
                  </button>
                </div>
                {simSuccess && (
                  <div className="rounded-lg border border-ok/40 bg-ok/10 p-2 text-[11.5px] text-ok">
                    ✓ {simSuccess}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <span className="text-[11.5px] text-faint">
            Personal WhatsApp Web protocol · Encrypted local storage
          </span>
          <Btn size="sm" variant="ghost" onClick={onClose}>
            Done
          </Btn>
        </div>
      </div>
    </div>
  );
}
