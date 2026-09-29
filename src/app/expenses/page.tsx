import { db } from "@/db";
import { expenseReports, expenseTransactions } from "@/db/schema";
import { Card, DemoTag, Icon, PageHead, fmtInr } from "@/components/ui";
import ExpenseForm from "@/components/ExpenseForm";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const now = new Date();
  const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const rows = await db.select().from(expenseTransactions);
  const report = (await db.select().from(expenseReports).limit(1))[0];

  const inRange = (from: Date, to: Date) => rows.filter((t) => t.ts >= from && t.ts <= to);
  const cur = inRange(curStart, now);
  const prev = inRange(prevStart, prevEnd);
  const total = (arr: typeof rows) => arr.reduce((a, t) => a + Number(t.amount), 0);
  const byCat = (arr: typeof rows) => {
    const m: Record<string, number> = {};
    arr.forEach((t) => { m[t.category] = (m[t.category] ?? 0) + Number(t.amount); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const curCat = byCat(cur);
  const prevCat: Record<string, number> = Object.fromEntries(byCat(prev));
  const curTotal = total(cur);
  const prevTotal = total(prev);
  const delta = prevTotal ? Math.round(((curTotal - prevTotal) / prevTotal) * 100) : 0;

  const insights: string[] = [];
  for (const [cat, amt] of curCat.slice(0, 3)) {
    const p = prevCat[cat];
    if (p && Math.abs(amt - p) > 50) insights.push(`${cat} spending is ${amt >= p ? "up" : "down"} ${Math.round((Math.abs(amt - p) / p) * 100)}% vs last month.`);
  }
  const subs = prevCat.Subscriptions ?? curCat.find((c) => c[0] === "Subscriptions")?.[1] ?? 0;
  if (prevTotal) insights.push(`Subscriptions represent ${Math.round((subs / prevTotal) * 100)}% of last month's spending.`);
  if (curCat[0]) insights.push(`${curCat[0][0]} is your largest category this month (${Math.round((curCat[0][1] / (curTotal || 1)) * 100)}%).`);

  const monthName = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const prevMonthName = prevStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const maxCat = Math.max(1, ...curCat.map((c) => c[1]));
  const largest = [...cur].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 3);

  return (
    <div>
      <PageHead
        title="Expenses"
        sub="Every number is computed from stored transactions — the AI explains them, it never invents them."
        right={<DemoTag />}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{monthName} (month to date)</div>
          <div className="mt-1 font-display text-[28px] font-semibold text-ink">{fmtInr(curTotal)}</div>
          <div className={`mt-0.5 text-[11.5px] ${delta >= 0 ? "text-warn" : "text-ok"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs {prevMonthName}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{prevMonthName}</div>
          <div className="mt-1 font-display text-[28px] font-semibold text-ink">{fmtInr(prevTotal)}</div>
          <div className="mt-0.5 text-[11.5px] text-faint">{prev.length} transactions</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">Largest this month</div>
          <div className="mt-1.5 space-y-1">
            {largest.map((t) => (
              <div key={t.id} className="flex justify-between text-[12px]">
                <span className="truncate text-muted">{t.merchant}</span>
                <span className="font-mono text-ink">{fmtInr(Number(t.amount))}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_340px]">
        <Card className="p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-faint">Category breakdown — {monthName}</div>
          <div className="space-y-2.5">
            {curCat.map(([cat, amt]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-[12.5px] text-muted">{cat}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-accent/80" style={{ width: `${(amt / maxCat) * 100}%` }} />
                </div>
                <span className="w-20 text-right font-mono text-[12px] text-ink">{fmtInr(amt)}</span>
              </div>
            ))}
            {curCat.length === 0 && <div className="text-[12.5px] text-faint">No transactions yet this month.</div>}
          </div>
          {insights.length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-line pt-3">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint"><Icon name="skills" size={11} className="text-info" /> Insights (computed, not guessed)</div>
              {insights.map((t, i) => (
                <div key={i} className="flex items-start gap-2 text-[12.5px] text-muted"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-info" />{t}</div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Add expense</div>
            <ExpenseForm />
          </Card>
          {report && (
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">Latest report</div>
                <span className="text-[11px] text-faint">{report.month}</span>
              </div>
              <div className="mb-2 font-display text-[20px] font-semibold text-ink">{fmtInr(report.total ?? 0)}</div>
              <div className="space-y-1">
                {Object.entries(report.breakdown ?? {}).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                  <div key={c} className="flex justify-between text-[12px]"><span className="text-muted">{c}</span><span className="font-mono text-ink">{fmtInr(v)}</span></div>
                ))}
              </div>
            </Card>
          )}
          <Card className="p-4 text-[12px] text-faint">
            <div className="mb-1 font-semibold text-muted">Data privacy</div>
            Transactions import only through the approved financial connector (sandbox PSP here). Orbit never reads bank passwords and never moves money without CRITICAL approval.
          </Card>
        </div>
      </div>
    </div>
  );
}
