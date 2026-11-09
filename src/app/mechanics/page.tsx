import { db } from "@/db";
import { experiments, hypotheses, mechanics } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { ORPHAN_BUFF_REFERENCES } from "@/lib/ark";
import { ClassificationBadge, DataTable, PageHeader, Panel, StatTile, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "tactical" | "amber" | "cool" | "danger" | "muted"> = {
  documented: "tactical",
  "source-supported": "tactical",
  "partially-verified": "amber",
  "needs-verification": "danger",
  "community-claimed": "amber",
  disputed: "danger",
  patched: "danger",
};

export default async function UndiscoveredMechanicsPage() {
  await ensureSeeded();
  const [mechanicRows, hypRows, expRows] = await Promise.all([
    db.select().from(mechanics),
    db.select().from(hypotheses),
    db.select().from(experiments),
  ]);

  const byStatus = mechanicRows.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {});

  const mechanicsHypotheses = hypRows.filter((h) => h.domain === "mechanics");

  return (
    <div>
      <PageHeader
        kicker="Section 06 · Undiscovered Mechanics"
        title="Hypothesis Generation & Mechanics Investigation"
        subtitle="The hypothesis engine continuously generates research questions from the knowledge base: unmeasured buff magnitudes, cross-creature interactions, player-buff × creature-aura combinations, map gating, benchmark violations and mechanic drift between game versions and server settings. Hypotheses are ranked by impact, novelty, evidence, feasibility and confidence — and nothing is promoted without recorded evidence."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Mechanics under investigation" value={mechanicRows.length} />
        <StatTile label="Needs verification" value={byStatus["needs-verification"] ?? 0} accent="amber" />
        <StatTile label="Hypotheses generated" value={hypRows.length} accent="cool" />
        <StatTile label="Experiments designed" value={expRows.length} accent="muted" hint="none executed automatically" />
      </div>

      <Panel title="Mechanics register" subtitle="documented vs reported behaviour" className="mt-4">
        <div className="space-y-3">
          {mechanicRows.map((m) => (
            <div key={m.slug} className="rounded border border-edge/60 bg-panel-2/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={STATUS_TONE[m.status] ?? "muted"}>{m.status}</Tag>
                <span className="data-font text-[10px] text-slate-600">{m.category}</span>
                <Tag tone={m.confidence === "documented" ? "tactical" : m.confidence === "community-reported" ? "amber" : "danger"}>
                  {m.confidence}
                </Tag>
              </div>
              <h3 className="mt-1 text-[13px] font-medium text-slate-100">{m.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{m.description}</p>
              <div className="mt-2 grid gap-2 text-[11px] leading-snug sm:grid-cols-2">
                <div className="rounded border border-edge/50 p-2">
                  <div className="data-font text-[10px] uppercase tracking-[0.2em] text-cool">Documented</div>
                  <div className="text-slate-400">{m.documentedBehaviour}</div>
                </div>
                <div className="rounded border border-edge/50 p-2">
                  <div className="data-font text-[10px] uppercase tracking-[0.2em] text-amber">Reported</div>
                  <div className="text-slate-400">{m.observedBehaviour}</div>
                </div>
              </div>
              <div className="data-font mt-2 text-[10px] text-slate-600">sources: {m.sourceKeys.join(", ")}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Generated hypotheses" subtitle={`${hypRows.length} total · mechanics domain ${mechanicsHypotheses.length}`} className="mt-4">
        <DataTable
          head={["Code", "Question", "Domain", "Impact", "Novelty", "Feasibility", "Confidence", "Priority"]}
          rows={[...hypRows]
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 35)
            .map((h) => [
              <span key="c" className="data-font text-[10px] text-slate-500">{h.code}</span>,
              <div key="q">
                <div className="text-[12px] text-slate-200">{h.question}</div>
                <div className="data-font text-[10px] text-slate-600">proposed by {h.proposedBy}</div>
              </div>,
              <span key="d" className="text-[11px] text-slate-400">{h.domain}</span>,
              <span key="i" className="data-font text-[11px] text-tactical">{h.impact}</span>,
              <span key="n" className="data-font text-[11px] text-amber">{h.novelty}</span>,
              <span key="f" className="data-font text-[11px] text-cool">{h.feasibility}</span>,
              <span key="cf" className="data-font text-[11px] text-slate-300">{h.confidence}</span>,
              <span key="p" className="data-font text-[11px] text-amber">{h.priority}</span>,
            ])}
        />
      </Panel>

      <Panel title="Knowledge-base integrity checks" className="mt-4">
        <div className="space-y-2 text-[12px] text-slate-400">
          <p>
            <ClassificationBadge value="UNVERIFIED" /> Every generated hypothesis starts at UNVERIFIED regardless of how
            plausible it looks. Priority ordering decides which experiment to run first; it never decides what is true.
          </p>
          <p>
            Orphan buff references (links without a defined effect):{" "}
            <span className="data-font text-slate-300">{ORPHAN_BUFF_REFERENCES.length === 0 ? "none — all links resolve" : ORPHAN_BUFF_REFERENCES.join(", ")}</span>
          </p>
          <p>
            Effects with an undocumented magnitude are excluded from all multiplier arithmetic; the combination explorer
            reports them as unknowns in the assumptions panel.
          </p>
        </div>
      </Panel>
    </div>
  );
}
