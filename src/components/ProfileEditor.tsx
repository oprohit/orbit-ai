"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Btn, Card, Icon } from "./ui";

interface ProfileEditorProps {
  initialProfile: {
    id: string;
    name: string;
    email: string | null;
    timezone: string | null;
  };
}

export default function ProfileEditor({ initialProfile }: ProfileEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialProfile.name || "Aarav");
  const [email, setEmail] = useState(initialProfile.email || "student@example.edu");
  const [timezone, setTimezone] = useState(initialProfile.timezone || "Asia/Kolkata");
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setBusy(true);
    setSavedMessage(null);
    try {
      const res = await fetch("/api/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "profile.update",
          id: initialProfile.id || "u1",
          name: name.trim(),
          email: email.trim(),
          timezone: timezone.trim(),
        }),
      });

      if (res.ok) {
        setSavedMessage("Name and profile updated successfully! ✓");
        setIsEditing(false);
        router.refresh();
        setTimeout(() => setSavedMessage(null), 4000);
      } else {
        alert("Failed to update profile");
      }
    } catch {
      alert("Error saving profile changes");
    } finally {
      setBusy(false);
    }
  };

  const initialLetter = (name.trim()[0] || "U").toUpperCase();

  return (
    <Card className="p-4 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft font-display text-[20px] font-bold text-accent shadow-sm">
            {initialLetter}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-semibold text-ink">{name}</span>
              <Badge tone="accent">Active User</Badge>
            </div>
            <div className="text-[12px] text-faint">
              {email} · {timezone}
            </div>
            <div className="mt-1 flex gap-1.5">
              <Badge tone="muted">COET · Engineering</Badge>
              <Badge tone="info">Orbit Primary Owner</Badge>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium text-muted transition hover:bg-white/5 hover:text-ink"
        >
          {isEditing ? "Cancel" : "Change Name"}
        </button>
      </div>

      {savedMessage && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[12px] font-medium text-ok animate-fade-in">
          <Icon name="check" size={13} /> {savedMessage}
        </div>
      )}

      {isEditing && (
        <form onSubmit={handleSave} className="mt-4 space-y-3 border-t border-line/60 pt-3.5 animate-fade-in">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-faint mb-1">
              Your Name (Displayed across App & Emails)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name (e.g. Adithya, Rohit, Akash)"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-faint mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-faint mb-1">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Colombo">Asia/Colombo</option>
                <option value="UTC">UTC (GMT)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (BST)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted hover:bg-white/5"
            >
              Cancel
            </button>
            <Btn size="sm" variant="primary" disabled={busy}>
              {busy ? "Saving..." : "Save Profile Name"}
            </Btn>
          </div>
        </form>
      )}
    </Card>
  );
}
