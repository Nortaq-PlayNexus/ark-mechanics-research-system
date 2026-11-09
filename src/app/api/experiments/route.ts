import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { experiments } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { recordExperimentResult } from "@/lib/research/orchestrator";
import type { ImportedMeasurement } from "@/lib/engines/experiment";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSeeded();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const [row] = await db.select().from(experiments).where(eq(experiments.code, code)).limit(1);
    if (!row) return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    return NextResponse.json(row);
  }
  const rows = await db.select().from(experiments).orderBy(desc(experiments.createdAt)).limit(200);
  return NextResponse.json({
    count: rows.length,
    statusBreakdown: rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {}),
    experiments: rows,
  });
}

export async function POST(request: Request) {
  await ensureSeeded();
  const body = (await request.json().catch(() => ({}))) as {
    experimentCode?: string;
    measurements?: ImportedMeasurement[];
    replicates?: number;
    notes?: string;
    evidence?: { kind: string; uri: string; note: string }[];
    independentlyReplicatedBy?: string | null;
  };

  if (!body.experimentCode || !Array.isArray(body.measurements) || body.measurements.length === 0) {
    return NextResponse.json(
      { error: "experimentCode and a non-empty measurements array are required to record results" },
      { status: 400 },
    );
  }

  const result = await recordExperimentResult({
    experimentCode: body.experimentCode,
    measurements: body.measurements,
    replicates: Number(body.replicates ?? 1),
    notes: body.notes ?? "",
    evidence: body.evidence ?? [],
    independentlyReplicatedBy: body.independentlyReplicatedBy ?? null,
  });

  if (!result.ok) return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  return NextResponse.json(result);
}
