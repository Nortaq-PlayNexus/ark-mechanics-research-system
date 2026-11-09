import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { agentLogs, agents, campaigns, discoveries, experiments, hypotheses, researchTasks } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { KB_STATS } from "@/lib/ark";
import { ClassificationBadge, DataTable, Meter, PageHeader, Panel, StatTile, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CommandCentre() {
  await ensureSeeded();

  const [agentRows, taskRows, discoveryRows, hypRows, expRows, campaignRows, logRows] = await Promise.all([
    db.select().from(agents).orderBy(agents.code),
    db.select().from(researchTasks).orderBy(desc(researchTasks.priority)).limit(500),
    db.select().from(discoveries).orderBy(desc(discoveries.createdAt)).limit(8),
    db.select().from(hypotheses).orderBy(desc(hypotheses.priority)).limit(8),
    db.select().from(experiments).orderBy(desc(experiments.createdAt)).limit(200),
    db.select().from(campaigns).orderBy(campaigns.priority),
    db.select().from(agentLogs).orderBy(desc(agentLogs.createdAt)).limit(10),
  ]);

  const queued = taskRows.filter((t) => t.status === "queued");
  const completed = taskRows.filter((t) => t.status === "completed");
  const unverified = discoveryRows.length;
  const surprising = discoveryRows.filter((d) => d.surprising).length;

  return (
    <div>
      <PageHeader
        kicker="Section 00 · Command Centre"
        title="ARK Omniscience — Research Command"
        subtitle="An autonomous research division investigating creature combinations, buff interactions, raid mechanics and undocumented game behaviour in ARK: Survival Evolved. Twelve specialised agents generate hypotheses, a discovery engine screens every combination against baselines, and a validation agent designs the experiments that turn theory into evidence."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Creatures in knowledge base" value={KB_STATS.creatures} hint={`${KB_STATS.abilities} ability records`} />
        <StatTile label="Buff / status effects" value={KB_STATS.buffs} accent="amber" hint={`${KB_STATS.relations} creature↔buff links`} />
        <StatTile label="Research hypotheses" value={KB_STATS.creatures > 0 ? hypRows.length : 0} accent="cool" hint="ranked by priority" />
        <StatTile label="Experiments awaiting manual testing" value={expRows.filter((e) => e.status === "pending-manual-testing").length} accent="muted" hint="no results fabricated" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Agents active" value={`${agentRows.length}/12`} />
        <StatTile label="Queued tasks" value={queued.length} accent="amber" />
        <StatTile label="Completed tasks" value={completed.length} />
        <StatTile label="Surprising findings" value={surprising} accent="amber" hint={`${unverified} shown are the latest batch`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Agent roster" subtitle="current status" className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {agentRows.map((a) => (
              <Link
                key={a.code}
                href="/agents"
                className="group rounded-md border border-edge bg-panel-2/40 p-3 transition hover:border-tactical/40"
              >
                <div className="flex items-center gap-2">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-tactical" />
                  <span className="data-font text-[10px] uppercase tracking-[0.2em] text-slate-500">{a.code}</span>
                  <span className="ml-auto data-font text-[10px] text-slate-500">{a.status}</span>
                </div>
                <div className="mt-1 text-sm font-medium text-slate-200 group-hover:text-tactical">{a.name}</div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">{a.role}</div>
                <div className="data-font mt-2 flex gap-3 text-[10px] text-slate-500">
                  <span>findings {a.findingsCount}</span>
                  <span>tasks {a.tasksCompleted}</span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Highest-priority hypotheses" subtitle="auto-ranked">
          <ol className="space-y-3">
            {hypRows.map((h) => (
              <li key={h.code} className="border-b border-edge/50 pb-2 last:border-0">
                <div className="flex items-baseline gap-2">
                  <span className="data-font text-[10px] text-amber">{h.code}</span>
                  <span className="data-font text-[10px] text-slate-600">p{h.priority}</span>
                </div>
                <p className="mt-1 text-[12px] leading-snug text-slate-300">{h.question}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Tag>{h.domain}</Tag>
                  <Tag tone="cool">confidence {h.confidence}</Tag>
                  <Tag tone="amber">novelty {h.novelty}</Tag>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Latest discoveries" subtitle="evidence-graded">
          <ul className="space-y-3">
            {discoveryRows.map((d) => (
              <li key={d.code} className="border-b border-edge/50 pb-3 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="data-font text-[10px] text-slate-600">{d.code}</span>
                  <ClassificationBadge value={d.classification} />
                  {d.surprising ? <Tag tone="amber">surprising</Tag> : null}
                  <span className="data-font ml-auto text-[10px] text-slate-500">{d.foundBy}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-200">{d.title}</p>
                <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-slate-400">{d.summary}</p>
                <div className="mt-2">
                  <Meter label={`confidence ${d.confidenceScore}/100`} value={d.confidenceScore} tone={d.confidenceScore > 60 ? "tactical" : "amber"} />
                </div>
              </li>
            ))}
          </ul>
          <Link href="/discoveries" className="data-font mt-3 inline-block text-[11px] uppercase tracking-[0.2em] text-tactical">
            Open discovery database →
          </Link>
        </Panel>

        <div className="space-y-4">
          <Panel title="Research campaigns" subtitle="active priorities">
            <DataTable
              head={["Code", "Campaign", "Domain", "P"]}
              rows={campaignRows.map((c) => [
                <span key="c" className="data-font text-[10px] text-slate-500">{c.code}</span>,
                <span key="t" className="text-[12px] text-slate-200">{c.title}</span>,
                <span key="d" className="text-[11px] text-slate-400">{c.domain}</span>,
                <span key="p" className="data-font text-[11px] text-amber">{c.priority}</span>,
              ])}
            />
          </Panel>

          <Panel title="Agent activity log" subtitle="live feed">
            <ul className="space-y-2">
              {logRows.map((l) => (
                <li key={l.id} className="flex gap-2 text-[11px] leading-snug">
                  <span className="data-font shrink-0 text-slate-600">{l.agentCode}</span>
                  <span className="text-slate-400">{l.message}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Mission status" className="mt-4">
        <div className="grid gap-3 text-[12px] leading-relaxed text-slate-400 sm:grid-cols-3">
          <div>
            <div className="data-font mb-1 text-[10px] uppercase tracking-[0.2em] text-tactical">Built</div>
            Knowledge base seeded with creatures, abilities, buffs, immunities, weight reductions, maps, bosses, breeding
            programmes, patch history and a source registry with reliability ratings.
          </div>
          <div>
            <div className="data-font mb-1 text-[10px] uppercase tracking-[0.2em] text-tactical">Initialised</div>
            Twelve agents have executed their first research pass, produced findings, and registered a shared task queue
            with deduplication. Ten campaigns are open with reports attached.
          </div>
          <div>
            <div className="data-font mb-1 text-[10px] uppercase tracking-[0.2em] text-amber">Next</div>
            Execute the designed experiments in the Experiment Manager and record real measurements. Only recorded
            evidence can move a discovery above SOURCE-SUPPORTED.
          </div>
        </div>
      </Panel>
    </div>
  );
}
