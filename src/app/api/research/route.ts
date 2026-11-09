import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { discoveries, experiments, hypotheses } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSeeded();
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "discoveries";
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));

  if (type === "hypotheses") {
    const rows = await db.select().from(hypotheses).orderBy(desc(hypotheses.priority)).limit(limit);
    return NextResponse.json({ count: rows.length, hypotheses: rows });
  }
  if (type === "experiments") {
    const rows = await db.select().from(experiments).orderBy(desc(experiments.createdAt)).limit(limit);
    return NextResponse.json({ count: rows.length, experiments: rows });
  }
  if (type === "mechanics") {
    const rows = await db.select().from(hypotheses).orderBy(desc(hypotheses.novelty)).limit(limit);
    return NextResponse.json({ count: rows.length, hypotheses: rows });
  }
  const rows = await db.select().from(discoveries).orderBy(desc(discoveries.confidenceScore)).limit(limit);
  return NextResponse.json({
    count: rows.length,
    classificationBreakdown: rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.classification] = (acc[r.classification] ?? 0) + 1;
      return acc;
    }, {}),
    discoveries: rows,
  });
}
