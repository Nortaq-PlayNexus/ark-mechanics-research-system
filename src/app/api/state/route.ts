import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentLogs, agents, campaigns, discoveries, experiments, hypotheses, researchTasks, reports } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { KB_STATS } from "@/lib/ark";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const [agentRows, taskRows, logRows, discoveryRows, campaignRows, experimentRows, hypothesisRows, reportRows] =
    await Promise.all([
      db.select().from(agents).orderBy(agents.code),
      db.select().from(researchTasks).orderBy(desc(researchTasks.priority)).limit(200),
      db.select().from(agentLogs).orderBy(desc(agentLogs.createdAt)).limit(40),
      db.select().from(discoveries).orderBy(desc(discoveries.createdAt)).limit(20),
      db.select().from(campaigns).orderBy(campaigns.priority),
      db.select().from(experiments).orderBy(desc(experiments.createdAt)).limit(20),
      db.select().from(hypotheses).orderBy(desc(hypotheses.priority)).limit(12),
      db.select().from(reports).orderBy(reports.code),
    ]);

  return NextResponse.json({
    knowledgeBase: KB_STATS,
    agents: agentRows,
    tasks: taskRows,
    logs: logRows,
    latestDiscoveries: discoveryRows,
    campaigns: campaignRows,
    latestExperiments: experimentRows,
    topHypotheses: hypothesisRows,
    reports: reportRows.map((r) => ({ code: r.code, title: r.title, kind: r.kind })),
    counts: {
      tasks: taskRows.length,
      queued: taskRows.filter((t) => t.status === "queued").length,
      completed: taskRows.filter((t) => t.status === "completed").length,
      experimentsAwaiting: experimentRows.filter((e) => e.status === "pending-manual-testing").length,
      unverified: discoveryRows.filter((d) => d.classification === "UNVERIFIED").length,
    },
  });
}

export async function POST(request: Request) {
  await ensureSeeded();
  const body = (await request.json().catch(() => ({}))) as { action?: string; agentCode?: string };
  if (body.action !== "queue-agent-task" || !body.agentCode) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }
  const [agent] = await db.select().from(agents).where(eq(agents.code, body.agentCode)).limit(1);
  if (!agent) return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  return NextResponse.json({ ok: true, agent });
}
