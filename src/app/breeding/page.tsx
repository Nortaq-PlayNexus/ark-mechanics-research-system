import { db } from "@/db";
import { breedingPrograms, discoveries } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { CREATURE_BY_SLUG } from "@/lib/ark";
import { ClassificationBadge, DataTable, PageHeader, Panel, StatTile, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BreedingPage() {
  await ensureSeeded();
  const [programRows, discoveryRows] = await Promise.all([
    db.select().from(breedingPrograms),
    db.select().from(discoveries),
  ]);
  const breedingFindings = discoveryRows.filter((d) => d.domain === "breeding");

  return (
    <div>
      <PageHeader
        kicker="Section 10 · Breeding & Mutation Laboratory"
        title="Genetics, Imprinting & Role Specialisation"
        subtitle="Breeding research maps stat priorities and mutation strategy to specific combat roles. The dominant conclusion is strategic rather than statistical: nursery throughput and egg-production auras set the ceiling on every combat line, so utility lines should be bred before any additional combat mutation is chased."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Breeding programmes" value={programRows.length} />
        <StatTile label="Documented programmes" value={programRows.filter((p) => p.confidence === "documented").length} accent="cool" />
        <StatTile label="Utility-first programmes" value={programRows.filter((p) => p.role.toLowerCase().includes("nursery") || p.role.toLowerCase().includes("logistics")).length} accent="amber" />
        <StatTile label="Generations modelled" value={programRows.reduce((n, p) => n + p.generations, 0)} accent="muted" />
      </div>

      <Panel title="Breeding programmes by role" className="mt-4">
        <DataTable
          head={["Species", "Role", "Stat priority", "Mutation strategy", "Generations", "Confidence"]}
          rows={programRows.map((p) => [
            <div key="s">
              <div className="text-[12px] font-medium text-slate-100">{CREATURE_BY_SLUG.get(p.species)?.name ?? p.species}</div>
              <div className="data-font text-[10px] text-slate-600">{p.slug}</div>
            </div>,
            <span key="r" className="text-[11px] text-slate-300">{p.role}</span>,
            <div key="sp" className="flex flex-wrap gap-1">
              {p.statPriorities.map((s, i) => (
                <Tag key={s} tone={i === 0 ? "tactical" : "muted"}>
                  {i + 1}. {s}
                </Tag>
              ))}
            </div>,
            <span key="m" className="text-[11px] leading-snug text-slate-400">{p.mutationStrategy}</span>,
            <span key="g" className="data-font text-[11px] text-slate-300">{p.generations}</span>,
            <Tag key="c" tone={p.confidence === "documented" ? "tactical" : "amber"}>
              {p.confidence}
            </Tag>,
          ])}
        />
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Mutation & imprinting rules in the knowledge base">
          <ul className="space-y-2 text-[12px] leading-relaxed text-slate-400">
            <li>
              <span className="text-tactical">Per-stat mutation guardrail.</span> Keep mutation counters separate per stat by
              running clean stat lines and combining late; a line that crosses the guardrail stops accepting new mutations
              for that stat.
            </li>
            <li>
              <span className="text-tactical">Imprinting.</span> The imprint bonus applies to stats and to rider damage.
              For lines intended to be ridden, imprinting frequently contributes more than an additional mutation.
            </li>
            <li>
              <span className="text-tactical">Stat inheritance.</span> Offspring inherit the higher of each parent&apos;s
              visible stat with a chance-based roll; record both parents&apos; stats before mating to keep a line auditable.
            </li>
            <li>
              <span className="text-tactical">Nursery throughput.</span> Maewing nurse mode and the Oviraptor egg aura
              multiply how many creatures reach fighting condition per week — the real bottleneck on war readiness.
            </li>
            <li>
              <span className="text-amber">Unverified.</span> Whether imprint percentage interacts with buff multipliers
              additively or multiplicatively is not documented and requires measurement.
            </li>
          </ul>
        </Panel>

        <Panel title="Breeding research findings">
          {breedingFindings.length === 0 ? (
            <p className="text-[12px] text-slate-500">No breeding findings recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {breedingFindings.map((d) => (
                <div key={d.code} className="rounded border border-edge/60 bg-panel-2/30 p-3">
                  <div className="flex items-center gap-2">
                    <ClassificationBadge value={d.classification} />
                    <span className="data-font ml-auto text-[10px] text-slate-500">{d.foundBy}</span>
                  </div>
                  <p className="mt-1 text-[13px] font-medium text-slate-100">{d.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{d.summary}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
