import { NextResponse } from "next/server";
import { seedDemo } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await seedDemo();
    return NextResponse.json({
      ok: true,
      message: "Demo workspace reset successfully to original state.",
    });
  } catch (err) {
    console.error("Failed to reset demo:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
