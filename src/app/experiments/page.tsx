import { desc } from "drizzle-orm";
import { db } from "@/db";
import { experiments } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { ExperimentRecorder } from "@/components/ExperimentRecorder";
import { ClassificationBadge, PageHeader, Panel, StatTile, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExperimentManagerPage() {
  await ensureSeeded();
  const rows = await db.select().from(experiments).orderBy(desc(experiments.createdAt));
  const pending = rows.filter((e) => e.status === "pending-manual-testing");
  const recorded = rows.filter((e) => e.status === "recorded");

  return (
    <div>
      <PageHeader
        kicker="Section 02 · Experiment Manager"
        title="Experimental Research Laboratory"
        subtitle="Every hypothesis above the priority threshold has a designed experiment with a unique ID, controlled conditions, a baseline run, a single-variable run and a replication requirement. All experiments start as pending-manual-testing: the platform designs them, it does not invent their results."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Experiments designed" value={rows.length} />
        <StatTile label="Awaiting manual testing" value={pending.length} accent="amber" />
        <StatTile label="Results recorded by operator" value={recorded.length} accent="cool" />
        <StatTile
          label="Highest recorded confidence"
          value={recorded.length ? Math.max(...recorded.map((r) => r.confidence)) : 0}
          accent="muted"
        />
      </div>

      <div className="mt-4">
        <ExperimentRecorder experiments={rows.map((e) => ({ code: e.code, title: e.title }))} />
      </div>

      <div className="mt-4 space-y-3">
        {rows.slice(0, 30).map((e) => (
          <Panel
            key={e.code}
            title={`${e.code} · ${e.title.slice(0, 90)}`}
            subtitle={e.hypothesisCode ? `hypothesis ${e.hypothesisCode}` : "standalone"}
            right={<ClassificationBadge value={e.classification} />}
          >
            <p className="text-[12px] leading-relaxed text-slate-300">{e.question}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Tag tone={e.status === "recorded" ? "tactical" : "amber"}>{e.status}</Tag>
              <Tag tone="cool">{e.assignedAgent}</Tag>
              <Tag>{e.replicates} replicates</Tag>
              <Tag>{e.conditions.gameMode}</Tag>
              <Tag>{e.conditions.map}</Tag>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <div className="data-font mb-1 text-[10px] uppercase tracking-[0.2em] text-tactical">Procedure</div>
                <ol className="space-y-1 text-[11px] leading-snug text-slate-400">
                  {e.procedure.map((p, i) => (
                    <li key={i}>
                      {i + 1}. {p}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="data-font mb-1 text-[10px] uppercase tracking-[0.2em] text-cool">Controlled conditions</div>
                  <ul className="data-font space-y-1 text-[10px] leading-snug text-slate-400">
                    <li>version: {e.conditions.gameVersion}</li>
                    <li>map: {e.conditions.map}</li>
                    <li>mode: {e.conditions.gameMode}</li>
                    <li>server: {e.conditions.serverSettings}</li>
                    <li>equipment: {e.conditions.equipment}</li>
                    <li>levels: {e.conditions.creatureLevels}</li>
                    <li>stats: {e.conditions.creatureStats}</li>
                  </ul>
                </div>
                <div>
                  <div className="data-font mb-1 text-[10px] uppercase tracking-[0.2em] text-amber">Limitations</div>
                  <ul className="space-y-1 text-[11px] leading-snug text-slate-400">
                    {e.limitations.split("\n").filter(Boolean).map((l, i) => (
                      <li key={i}>• {l}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {e.status === "recorded" ? (
              <div className="mt-3 rounded border border-tactical/30 bg-tactical/5 p-3">
                <div className="data-font text-[10px] uppercase tracking-[0.2em] text-tactical">Recorded results</div>
                <pre className="data-font mt-1 whitespace-pre-wrap text-[11px] leading-snug text-slate-300">{e.results}</pre>
                {e.evidence?.length ? (
                  <div className="data-font mt-2 text-[10px] text-slate-500">
                    evidence: {e.evidence.map((ev) => `${ev.kind}:${ev.uri}`).join(", ")}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>
        ))}
      </div>
    </div>
  );
}
