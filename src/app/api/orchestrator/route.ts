import { NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/db/seed";
import { runResearchCycle } from "@/lib/research/orchestrator";
import { generateAllReports } from "@/lib/research/reports";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  await ensureSeeded();
  return NextResponse.json({ status: "idle", message: "POST to this endpoint to run a research cycle." });
}

export async function POST(request: Request) {
  await ensureSeeded();
  const body = (await request.json().catch(() => ({}))) as { reportsOnly?: boolean };
  try {
    if (body.reportsOnly) {
      const reports = await generateAllReports();
      return NextResponse.json({ ok: true, reportsGenerated: reports });
    }
    const result = await runResearchCycle({ initial: false });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "cycle failed" },
      { status: 500 },
    );
  }
}
