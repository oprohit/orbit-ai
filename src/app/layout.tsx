import type { Metadata } from "next";
import { Space_Grotesk, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvals, notifications } from "@/db/schema";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ORBIT AI — Give it a goal. Stay in control.",
  description:
    "Orbit AI is a personal AI assistant and constrained agentic automation platform: goals, tasks, connectors, approvals and a complete audit trail.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [pending, unread] = await Promise.all([
    db.select().from(approvals).where(eq(approvals.status, "pending")),
    db.select().from(notifications).where(eq(notifications.read, false)),
  ]);
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-body antialiased">
        <Sidebar approvals={pending.length} notifications={unread.length} />
        <div className="min-h-screen md:pl-[236px]">
          <main className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-7">{children}</main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
