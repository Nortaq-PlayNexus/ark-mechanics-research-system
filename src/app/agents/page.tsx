import { desc } from "drizzle-orm";
import { db } from "@/db";
import { agentLogs, agents, discoveries, researchTasks } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { AGENT_BY_CODE } from "@/lib/agents/registry";
import { AgentConsole } from "@/components/AgentConsole";
import { ClassificationBadge, DataTable, PageHeader, Panel, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AgentControlPage() {
  await ensureSeeded();
  const [agentRows, taskRows, logRows, discoveryRows] = await Promise.all([
    db.select().from(agents).orderBy(agents.code),
    db.select().from(researchTasks).orderBy(desc(researchTasks.priority)).limit(400),
    db.select().from(agentLogs).orderBy(desc(agentLogs.createdAt)).limit(60),
    db.select().from(discoveries).orderBy(desc(discoveries.createdAt)).limit(300),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Section 01 · Research Agent Control"
        title="Autonomous Research Agents"
        subtitle="Twelve specialists operate on a shared research task system rather than as disconnected chatbots: hypotheses are generated once, deduplicated by the director, assigned by domain, executed against the knowledge base, and turned into evidence-graded findings."
      />

      <AgentConsole agents={agentRows.map((a) => ({ code: a.code, name: a.name, role: a.role, domain: a.domain }))} />

      <div className="mt-4 space-y-3">
        {agentRows.map((a) => {
          const definition = AGENT_BY_CODE.get(a.code);
          const tasks = taskRows.filter((t) => t.agentCode === a.code);
          const findings = discoveryRows.filter((d) => d.foundBy === a.code);
          return (
            <Panel
              key={a.code}
              title={`${a.code} · ${a.name}`}
              subtitle={a.domain}
              right={<span className="data-font text-[10px] text-tactical">{a.status}</span>}
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <p className="text-[12px] leading-relaxed text-slate-400">{a.mandate}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(definition?.methods ?? []).map((m) => (
                      <Tag key={m} tone="cool">
                        {m}
                      </Tag>
                    ))}
                  </div>
                  {findings.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {findings.slice(0, 3).map((f) => (
                        <li key={f.code} className="border-b border-edge/50 pb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <ClassificationBadge value={f.classification} />
                            <span className="data-font text-[10px] text-slate-500">confidence {f.confidenceScore}</span>
                          </div>
                          <p className="mt-1 text-[12px] font-medium text-slate-200">{f.title}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">{f.summary}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div>
                  <div className="data-font mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    Task queue ({tasks.filter((t) => t.status === "queued").length} queued / {tasks.filter((t) => t.status === "completed").length} done)
                  </div>
                  <ul className="space-y-2">
                    {tasks.slice(0, 6).map((t) => (
                      <li key={t.code} className="rounded border border-edge/60 bg-panel-2/40 p-2">
                        <div className="flex items-center gap-2">
                          <span className="data-font text-[10px] text-slate-600">{t.code}</span>
                          <Tag tone={t.status === "completed" ? "tactical" : "amber"}>{t.status}</Tag>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-300">{t.title}</p>
                      </li>
                    ))}
                    {tasks.length === 0 ? <li className="text-[11px] text-slate-500">No tasks assigned yet.</li> : null}
                  </ul>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel title="Research task register" subtitle="shared queue with deduplication" className="mt-4">
        <DataTable
          head={["Task", "Agent", "Domain", "Status", "Priority", "Summary"]}
          rows={taskRows.slice(0, 40).map((t) => [
            <div key="t">
              <div className="data-font text-[10px] text-slate-600">{t.code}</div>
              <div className="text-[12px] text-slate-200">{t.title}</div>
            </div>,
            <span key="a" className="data-font text-[11px] text-slate-400">{t.agentCode}</span>,
            <span key="d" className="text-[11px] text-slate-400">{t.domain}</span>,
            <Tag key="s" tone={t.status === "completed" ? "tactical" : "amber"}>{t.status}</Tag>,
            <span key="p" className="data-font text-[11px] text-amber">{t.priority}</span>,
            <span key="s2" className="line-clamp-2 text-[11px] text-slate-400">{t.summary || t.question}</span>,
          ])}
        />
      </Panel>

      <Panel title="Agent communication log" subtitle="director coordination feed" className="mt-4">
        <DataTable
          head={["Agent", "Level", "Message"]}
          rows={logRows.map((l) => [
            <span key="a" className="data-font text-[11px] text-tactical">{l.agentCode}</span>,
            <Tag key="l" tone={l.level === "warn" ? "amber" : "muted"}>{l.level}</Tag>,
            <span key="m" className="text-[11px] leading-snug text-slate-400">{l.message}</span>,
          ])}
        />
      </Panel>
    </div>
  );
}
