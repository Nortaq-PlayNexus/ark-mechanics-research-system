import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  agents,
  breedingPrograms,
  bosses,
  buffs,
  campaigns,
  combinations,
  creatures,
  discoveries,
  experiments,
  hypotheses,
  mechanics,
  patchHistory,
  reports,
  researchTasks,
  settings,
  sources,
} from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Full research-database export (backup / interop between installations). */
export async function GET() {
  await ensureSeeded();
  const [
    agentRows,
    creatureRows,
    buffRows,
    combinationRows,
    hypothesisRows,
    experimentRows,
    discoveryRows,
    sourceRows,
    campaignRows,
    reportRows,
    taskRows,
    mechanicRows,
    breedingRows,
    bossRows,
    patchRows,
    settingRows,
  ] = await Promise.all([
    db.select().from(agents),
    db.select().from(creatures),
    db.select().from(buffs),
    db.select().from(combinations).orderBy(desc(combinations.synergyScore)).limit(500),
    db.select().from(hypotheses).orderBy(desc(hypotheses.priority)).limit(1000),
    db.select().from(experiments),
    db.select().from(discoveries),
    db.select().from(sources),
    db.select().from(campaigns),
    db.select().from(reports),
    db.select().from(researchTasks),
    db.select().from(mechanics),
    db.select().from(breedingPrograms),
    db.select().from(bosses),
    db.select().from(patchHistory),
    db.select().from(settings),
  ]);

  const payload = {
    format: "ark-omniscience/export",
    version: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      agents: agentRows.length,
      creatures: creatureRows.length,
      buffs: buffRows.length,
      combinations: combinationRows.length,
      hypotheses: hypothesisRows.length,
      experiments: experimentRows.length,
      discoveries: discoveryRows.length,
      sources: sourceRows.length,
      reports: reportRows.length,
    },
    data: {
      agents: agentRows,
      creatures: creatureRows,
      buffs: buffRows,
      combinations: combinationRows,
      hypotheses: hypothesisRows,
      experiments: experimentRows,
      discoveries: discoveryRows,
      sources: sourceRows,
      campaigns: campaignRows,
      reports: reportRows,
      researchTasks: taskRows,
      mechanics: mechanicRows,
      breedingPrograms: breedingRows,
      bosses: bossRows,
      patchHistory: patchRows,
      settings: settingRows,
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="ark-omniscience-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

/** Import evidence: records measurements for an existing experiment code. */
export async function POST(request: Request) {
  await ensureSeeded();
  const body = (await request.json().catch(() => ({}))) as {
    experimentCode?: string;
    measurements?: { metric: string; baseline: number | null; experimental: number | null; samples?: number }[];
    replicates?: number;
    notes?: string;
    evidence?: { kind: string; uri: string; note: string }[];
    independentlyReplicatedBy?: string | null;
  };
  if (!body.experimentCode || !body.measurements?.length) {
    return NextResponse.json({ error: "experimentCode and measurements are required" }, { status: 400 });
  }
  const { recordExperimentResult } = await import("@/lib/research/orchestrator");
  const result = await recordExperimentResult({
    experimentCode: body.experimentCode,
    measurements: body.measurements,
    replicates: Number(body.replicates ?? 1),
    notes: body.notes ?? "Imported via API",
    evidence: body.evidence ?? [],
    independentlyReplicatedBy: body.independentlyReplicatedBy ?? null,
  });
  return NextResponse.json(result);
}
