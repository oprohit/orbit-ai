"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "./ui";

const CATS = ["Food", "Travel", "Shopping", "Education", "Subscriptions", "Bills", "Other"];

export default function ExpenseForm() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [merchant, setMerchant] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const add = async () => {
    if (!amount) return;
    setBusy(true);
    try {
      await fetch("/api/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expense.add", amount: Number(amount), category, merchant: merchant || null }),
      });
      setAmount(""); setMerchant(""); setDone(true);
      setTimeout(() => setDone(false), 2500);
      router.refresh();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} placeholder="Amount ₹" className="h-8 flex-1 rounded-lg border border-line bg-bg px-2.5 text-[13px] text-ink placeholder:text-faint" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 rounded-lg border border-line bg-bg px-2 text-[12.5px] text-ink">
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Merchant (optional)" className="h-8 w-full rounded-lg border border-line bg-bg px-2.5 text-[13px] text-ink placeholder:text-faint" />
      <Btn variant="primary" size="sm" disabled={busy || !amount} onClick={() => void add()} className="w-full">
        {done ? "Added ✓" : "Add expense"}
      </Btn>
    </div>
  );
}
