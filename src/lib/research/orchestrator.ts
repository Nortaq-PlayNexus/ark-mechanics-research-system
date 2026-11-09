import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  agentLogs,
  agents,
  campaigns,
  combinations,
  discoveries,
  experiments,
  hypotheses,
  researchTasks,
} from "@/db/schema";
import { AGENTS } from "@/lib/agents/registry";
import { runAgent } from "@/lib/agents/execution";
import { generateHypotheses, type HypothesisDraft } from "@/lib/engines/hypothesis";
import { designExperiment, importResults, type ExperimentDraft, type ImportedMeasurement } from "@/lib/engines/experiment";
import { analyseCombination, candidateCombinations, type ResearchContext } from "@/lib/engines/synergy";
import { seedKnowledgeBase } from "@/lib/db/seed";
import { generateAllReports } from "./reports";

export interface CycleResult {
  cycle: number;
  hypothesesCreated: number;
  tasksCreated: number;
  tasksCompleted: number;
  experimentsCreated: number;
  discoveriesCreated: number;
  combinationsRecorded: number;
  reportsCreated: number;
  durationMs: number;
  agents: { code: string; findings: number; tasks: number }[];
}

function pad(n: number, width = 4): string {
  return String(n).padStart(width, "0");
}

async function nextSequence(prefix: string, table: "hypotheses" | "experiments" | "discoveries" | "researchTasks"): Promise<number> {
  const map = { hypotheses, experiments, discoveries, researchTasks } as const;
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(map[table]);
  return Number(row?.count ?? 0) + 1;
}

async function persistHypotheses(): Promise<{ created: number; all: HypothesisDraft[] }> {
  const all = generateHypotheses();
  const limited = all.slice(0, 400);
  let start = await nextSequence("HYP", "hypotheses");
  const rows = limited.map((h) => ({
    code: `HYP-${pad(start++)}`,
    question: h.question,
    statement: h.statement,
    rationale: h.rationale,
    domain: h.domain,
    targetSlugs: h.targetSlugs,
    buffSlugs: h.buffSlugs,
    impact: h.impact,
    novelty: h.novelty,
    evidence: h.evidence,
    feasibility: h.feasibility,
    confidence: h.confidence,
    priority: h.priority,
    status: "open",
    proposedBy: h.proposedBy,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(hypotheses).values(rows.slice(i, i + 200)).onConflictDoNothing();
  }
  return { created: rows.length, all };
}

async function persistCombinations(): Promise<number> {
  let created = 0;
  const contexts: ResearchContext[] = ["raid-assault", "raid-defence", "boss-arena", "pvp-open"];
  for (const context of contexts) {
    for (const cand of candidateCombinations(context, 25)) {
      const analysis = analyseCombination(cand.slugs, context);
      const inserted = await db
        .insert(combinations)
        .values({
          hash: analysis.hash,
          memberSlugs: analysis.memberSlugs,
          size: analysis.memberSlugs.length,
          context,
          analysis: {
            metrics: analysis.metrics,
            partyScore: analysis.partyScore,
            bestSingleScore: analysis.bestSingleScore,
            meanMemberScore: analysis.meanMemberScore,
            synergyScore: analysis.synergyScore,
            estimatedDamageMultiplier: analysis.estimatedDamageMultiplier,
            estimatedMitigation: analysis.estimatedMitigation,
            supportCoverage: analysis.supportCoverage,
            assumptions: analysis.assumptions,
            limitations: analysis.limitations,
            buffInteractions: analysis.buffInteractions,
            conflicts: analysis.conflicts,
            cost: analysis.cost,
          },
          synergyScore: analysis.synergyScore,
          synergyDelta: analysis.synergyDelta,
          classification: analysis.classification,
          rationale: analysis.rationale,
        })
        .onConflictDoNothing()
        .returning({ id: combinations.id });
      created += inserted.length;
    }
  }
  return created;
}

async function persistAgentRuns(hypothesisRows: { code: string; domain: string }[]): Promise<{
  discoveriesCreated: number;
  tasksCreated: number;
  tasksCompleted: number;
  agentStats: { code: string; findings: number; tasks: number }[];
}> {
  const domainIndex = new Map<string, string[]>();
  for (const h of hypothesisRows) {
    const list = domainIndex.get(h.domain) ?? [];
    list.push(h.code);
    domainIndex.set(h.domain, list);
  }

  let discoverySeq = await nextSequence("DISC", "discoveries");
  let taskSeq = await nextSequence("TASK", "researchTasks");
  let discoveriesCreated = 0;
  let tasksCreated = 0;
  let tasksCompleted = 0;
  const agentStats: { code: string; findings: number; tasks: number }[] = [];

  for (const agent of AGENTS) {
    const result = runAgent(agent.code);
    const assigned = domainIndex.get(agent.domain) ?? [];

    // 1. agent log entries
    if (result.logs.length > 0) {
      await db.insert(agentLogs).values(
        result.logs.map((l) => ({ agentCode: agent.code, level: l.level, message: l.message, meta: result.stats })),
      );
    }

    // 2. shared research tasks (queued work from the agent's domain)
    for (const outcome of result.taskOutcomes.slice(0, 8)) {
      const dedupeKey = `${agent.code}:${outcome.title}`.toLowerCase().slice(0, 200);
      const inserted = await db
        .insert(researchTasks)
        .values({
          code: `TASK-${pad(taskSeq++)}`,
          agentCode: agent.code,
          title: outcome.title,
          question: outcome.question,
          domain: agent.domain,
          priority: outcome.priority,
          status: outcome.outcome === "completed" ? "completed" : "queued",
          targetSlugs: [],
          dedupeKey,
          outcome: outcome.outcome,
          summary: outcome.summary,
          completedAt: outcome.outcome === "completed" ? new Date() : null,
        })
        .onConflictDoNothing()
        .returning({ id: researchTasks.id });
      tasksCreated += inserted.length;
      if (inserted.length > 0 && outcome.outcome === "completed") tasksCompleted += 1;
    }

    // 3. findings become discoveries (never above UNVERIFIED / SOURCE-SUPPORTED)
    for (const f of result.findings) {
      const inserted = await db
        .insert(discoveries)
        .values({
          code: `DISC-${pad(discoverySeq++)}`,
          title: f.title,
          summary: f.summary,
          domain: f.domain,
          classification: f.classification,
          confidenceScore: Math.round(f.confidenceScore),
          evidenceQuality: f.evidenceQuality,
          surprising: f.surprising,
          creatureSlugs: f.creatureSlugs,
          buffSlugs: f.buffSlugs,
          sourceKeys: f.sourceKeys,
          foundBy: f.foundBy,
        })
        .onConflictDoNothing()
        .returning({ id: discoveries.id });
      discoveriesCreated += inserted.length;
    }

    // 4. assign domain hypotheses to this agent as queued tasks
    for (const code of assigned.slice(0, 3)) {
      const [hyp] = await db.select().from(hypotheses).where(eq(hypotheses.code, code)).limit(1);
      if (!hyp) continue;
      const dedupeKey = `${agent.code}:hyp:${code}`.toLowerCase();
      const inserted = await db
        .insert(researchTasks)
        .values({
          code: `TASK-${pad(taskSeq++)}`,
          agentCode: agent.code,
          title: hyp.question.slice(0, 180),
          question: hyp.statement,
          domain: hyp.domain,
          priority: hyp.priority,
          status: "queued",
          hypothesisCode: hyp.code,
          targetSlugs: hyp.targetSlugs,
          dedupeKey,
        })
        .onConflictDoNothing()
        .returning({ id: researchTasks.id });
      tasksCreated += inserted.length;
    }

    // 5. update agent stats
    const completed = result.taskOutcomes.filter((t) => t.outcome === "completed").length;
    await db
      .update(agents)
      .set({
        status: "active",
        findingsCount: result.findings.length,
        tasksCompleted: completed,
        tasksFailed: 0,
        lastRunAt: new Date(),
      })
      .where(eq(agents.code, agent.code));

    agentStats.push({ code: agent.code, findings: result.findings.length, tasks: result.taskOutcomes.length });
    await db.insert(agentLogs).values({
      agentCode: "AGENT-12",
      level: "info",
      message: `${agent.code} (${agent.name}) completed a research pass: ${result.findings.length} findings, ${result.taskOutcomes.length} task updates.`,
      meta: { assignedHypotheses: assigned.length, ...result.stats },
    });
  }

  return { discoveriesCreated, tasksCreated, tasksCompleted, agentStats };
}

async function persistExperiments(hypothesisRows: { code: string; domain: string; priority: number }[]): Promise<{ created: number; codes: string[] }> {
  let seq = await nextSequence("EXP", "experiments");
  const codes: string[] = [];
  const targets = [...hypothesisRows].sort((a, b) => b.priority - a.priority).slice(0, 24);
  for (const h of targets) {
    const draft: ExperimentDraft = designExperiment(
      {
        question: "",
        statement: "",
        rationale: "",
        domain: h.domain,
        targetSlugs: [],
        buffSlugs: [],
        impact: 0,
        novelty: 0,
        evidence: 0,
        feasibility: 0,
        confidence: 0,
        priority: h.priority,
        dedupeKey: h.code,
        proposedBy: "AGENT-10",
        sourceKeys: [],
      },
      seq,
    );
    draft.code = `EXP-${pad(seq++)}`;
    draft.hypothesisCode = h.code;
    const inserted = await db
      .insert(experiments)
      .values({
        code: draft.code,
        hypothesisCode: draft.hypothesisCode,
        title: `Experiment for ${h.code}: ${draft.title || h.domain}`,
        question: draft.question || "Hypothesis validation experiment",
        status: draft.status,
        conditions: draft.conditions,
        procedure: draft.procedure,
        baseline: draft.baseline,
        measurements: draft.measurements,
        evidence: draft.evidence,
        results: draft.results,
        limitations: draft.limitations.join("\n"),
        confidence: draft.confidence,
        classification: draft.classification,
        replicates: draft.replicates,
        assignedAgent: draft.assignedAgent,
      })
      .onConflictDoNothing()
      .returning({ code: experiments.code });
    if (inserted.length > 0) codes.push(inserted[0].code);
  }
  return { created: codes.length, codes };
}

async function updateCampaigns(hypothesisRows: { code: string; domain: string }[], experimentCodes: string[], reportCode: string): Promise<void> {
  const rows = await db.select().from(campaigns);
  for (const campaign of rows) {
    const hyps = hypothesisRows.filter((h) => h.domain === campaign.domain).map((h) => h.code);
    const exps = experimentCodes.slice(0, 3);
    await db
      .update(campaigns)
      .set({ hypothesisCodes: hyps.slice(0, 40), experimentCodes: exps, reportCode, status: "report-published" })
      .where(eq(campaigns.code, campaign.code));
  }
}

export async function runResearchCycle(options: { initial?: boolean } = {}): Promise<CycleResult> {
  const started = Date.now();
  await seedKnowledgeBase();

  const [{ count: cycleCount }] = await db.select({ count: sql<number>`count(*)::int` }).from(researchTasks);
  const cycle = Number(cycleCount) > 0 && !options.initial ? 2 : 1;

  const hypothesisResult = await persistHypotheses();
  const hypothesisRows = await db
    .select({ code: hypotheses.code, domain: hypotheses.domain, priority: hypotheses.priority })
    .from(hypotheses)
    .orderBy(desc(hypotheses.priority))
    .limit(400);

  const agentResult = await persistAgentRuns(hypothesisRows);
  const experimentResult = await persistExperiments(hypothesisRows);
  const combinationsRecorded = await persistCombinations();
  const reports = await generateAllReports();
  await updateCampaigns(hypothesisRows, experimentResult.codes, reports[0]?.code ?? null);

  return {
    cycle,
    hypothesesCreated: hypothesisResult.created,
    tasksCreated: agentResult.tasksCreated,
    tasksCompleted: agentResult.tasksCompleted,
    experimentsCreated: experimentResult.created,
    discoveriesCreated: agentResult.discoveriesCreated,
    combinationsRecorded,
    reportsCreated: reports.length,
    durationMs: Date.now() - started,
    agents: agentResult.agentStats,
  };
}

/** Manual evidence import: the only path from UNVERIFIED to a validated classification. */
export async function recordExperimentResult(input: {
  experimentCode: string;
  measurements: ImportedMeasurement[];
  replicates: number;
  notes: string;
  evidence?: { kind: string; uri: string; note: string }[];
  independentlyReplicatedBy?: string | null;
}): Promise<{ ok: boolean; classification?: string; confidence?: number; results?: string; limitations?: string[] }> {
  const [exp] = await db.select().from(experiments).where(eq(experiments.code, input.experimentCode)).limit(1);
  if (!exp) return { ok: false };
  const validated = importResults({
    measurements: input.measurements,
    replicates: input.replicates,
    notes: input.notes,
    evidence: input.evidence,
    independentlyReplicatedBy: input.independentlyReplicatedBy ?? null,
  });

  await db
    .update(experiments)
    .set({
      status: "recorded",
      baseline: Object.fromEntries(input.measurements.map((m) => [m.metric, m.baseline])),
      measurements: Object.fromEntries(input.measurements.map((m) => [m.metric, m.experimental])),
      evidence: input.evidence ?? [],
      results: validated.results,
      limitations: validated.limitations.join("\n"),
      confidence: validated.confidence,
      classification: validated.classification,
      replicates: input.replicates,
      updatedAt: new Date(),
    })
    .where(eq(experiments.code, input.experimentCode));

  // propagate to the linked hypothesis and discovery
  if (exp.hypothesisCode) {
    await db.update(hypotheses).set({ status: "tested" }).where(eq(hypotheses.code, exp.hypothesisCode));
    await db
      .update(discoveries)
      .set({ classification: validated.classification, confidenceScore: validated.confidence, verifiedAt: new Date() })
      .where(eq(discoveries.experimentCode, exp.code));
  }

  await db.insert(agentLogs).values({
    agentCode: "AGENT-10",
    level: "info",
    message: `Manually recorded results for ${exp.code}: classification ${validated.classification} at confidence ${validated.confidence}.`,
    meta: { experimentCode: exp.code },
  });

  return {
    ok: true,
    classification: validated.classification,
    confidence: validated.confidence,
    results: validated.results,
    limitations: validated.limitations,
  };
}

/** Queue a new task for an agent without duplicating existing work. */
export async function queueResearchTask(input: {
  agentCode: string;
  title: string;
  question: string;
  domain: string;
  priority?: number;
  targetSlugs?: string[];
}): Promise<{ ok: boolean; code?: string; duplicate?: boolean }> {
  const [agent] = await db.select().from(agents).where(eq(agents.code, input.agentCode)).limit(1);
  if (!agent) return { ok: false };
  const dedupeKey = `${input.agentCode}:${input.title}`.toLowerCase().slice(0, 200);
  const [existing] = await db
    .select({ id: researchTasks.id, code: researchTasks.code })
    .from(researchTasks)
    .where(and(eq(researchTasks.dedupeKey, dedupeKey)))
    .limit(1);
  if (existing) return { ok: true, code: existing.code, duplicate: true };
  const seq = await nextSequence("TASK", "researchTasks");
  const code = `TASK-${pad(seq)}`;
  await db.insert(researchTasks).values({
    code,
    agentCode: input.agentCode,
    title: input.title,
    question: input.question,
    domain: input.domain,
    priority: input.priority ?? 3,
    status: "queued",
    targetSlugs: input.targetSlugs ?? [],
    dedupeKey,
  });
  await db.insert(agentLogs).values({
    agentCode: "AGENT-12",
    level: "info",
    message: `Director queued ${code} for ${input.agentCode}: ${input.title}`,
  });
  return { ok: true, code };
}
