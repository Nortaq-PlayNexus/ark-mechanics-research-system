import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, discoveries, hypotheses, mechanics, researchTasks } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { AGENT_BY_CODE } from "@/lib/agents/registry";
import { runAgent } from "@/lib/agents/execution";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const rows = await db.select().from(agents).orderBy(agents.code);
  const tasks = await db.select().from(researchTasks).orderBy(desc(researchTasks.priority)).limit(300);
  return NextResponse.json({
    count: rows.length,
    agents: rows.map((a) => ({
      ...a,
      definition: AGENT_BY_CODE.get(a.code) ?? null,
      openTasks: tasks.filter((t) => t.agentCode === a.code && t.status === "queued").length,
      completedTasks: tasks.filter((t) => t.agentCode === a.code && t.status === "completed").length,
    })),
  });
}

export async function POST(request: Request) {
  await ensureSeeded();
  const body = (await request.json().catch(() => ({}))) as { agentCode?: string; queueTask?: boolean; title?: string; question?: string };
  if (!body.agentCode || !AGENT_BY_CODE.has(body.agentCode)) {
    return NextResponse.json({ error: "Unknown agentCode" }, { status: 400 });
  }

  const [agentRow] = await db.select().from(agents).where(eq(agents.code, body.agentCode)).limit(1);
  const result = runAgent(body.agentCode);

  if (body.queueTask && body.title) {
    const { queueResearchTask } = await import("@/lib/research/orchestrator");
    const queued = await queueResearchTask({
      agentCode: body.agentCode,
      title: body.title,
      question: body.question ?? "Operator-requested investigation",
      domain: AGENT_BY_CODE.get(body.agentCode)!.domain,
      priority: 1,
    });
    return NextResponse.json({ agent: agentRow, result, queued });
  }

  return NextResponse.json({ agent: agentRow, result });
}
