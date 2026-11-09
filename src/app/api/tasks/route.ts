import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { researchTasks } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { queueResearchTask } from "@/lib/research/orchestrator";
import { AGENT_BY_CODE } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSeeded();
  const url = new URL(request.url);
  const agentCode = url.searchParams.get("agent");
  const status = url.searchParams.get("status");
  let rows = await db.select().from(researchTasks).orderBy(desc(researchTasks.priority)).limit(400);
  if (agentCode) rows = rows.filter((r) => r.agentCode === agentCode);
  if (status) rows = rows.filter((r) => r.status === status);
  return NextResponse.json({
    count: rows.length,
    breakdown: rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {}),
    tasks: rows,
  });
}

export async function POST(request: Request) {
  await ensureSeeded();
  const body = (await request.json().catch(() => ({}))) as {
    agentCode?: string;
    title?: string;
    question?: string;
    priority?: number;
    targetSlugs?: string[];
  };
  if (!body.agentCode || !body.title) {
    return NextResponse.json({ error: "agentCode and title are required" }, { status: 400 });
  }
  const definition = AGENT_BY_CODE.get(body.agentCode);
  if (!definition) return NextResponse.json({ error: "Unknown agentCode" }, { status: 400 });
  const result = await queueResearchTask({
    agentCode: body.agentCode,
    title: body.title,
    question: body.question ?? "Operator-directed investigation",
    domain: definition.domain,
    priority: body.priority ?? 2,
    targetSlugs: body.targetSlugs ?? [],
  });
  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  await ensureSeeded();
  const body = (await request.json().catch(() => ({}))) as { code?: string; status?: string; outcome?: string; summary?: string };
  if (!body.code) return NextResponse.json({ error: "code is required" }, { status: 400 });
  await db
    .update(researchTasks)
    .set({
      status: body.status ?? "completed",
      outcome: body.outcome ?? "completed",
      summary: body.summary ?? "Updated by operator",
      completedAt: new Date(),
    })
    .where(eq(researchTasks.code, body.code));
  return NextResponse.json({ ok: true });
}
