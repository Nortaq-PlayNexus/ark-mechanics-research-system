import { desc } from "drizzle-orm";
import { db } from "@/db";
import { combinations as combinationsTable, creatures as creaturesTable } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { CREATURE_BY_SLUG } from "@/lib/ark";
import { CombinationExplorer } from "@/components/CombinationExplorer";
import { ClassificationBadge, PageHeader, Panel, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

function nameOf(slug: string) {
  return CREATURE_BY_SLUG.get(slug)?.name ?? slug;
}

export default async function CombinationExplorerPage() {
  await ensureSeeded();
  const [creatureRows, combinationRows] = await Promise.all([
    db.select().from(creaturesTable),
    db.select().from(combinationsTable).orderBy(desc(combinationsTable.synergyScore)).limit(50),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Section 04 · Combination Explorer"
        title="Creature Combination Discovery Engine"
        subtitle="Select creatures and a research context. The engine computes additive axes with a crowding coefficient, models a front line for mitigation, scores coverage axes with diminishing returns, screens every buff pair for compatibility, flags friendly-fire conflicts, and compares the party against its own best single member so that redundancy is not mistaken for synergy."
      />

      <CombinationExplorer
        creatures={creatureRows.map((c) => ({
          slug: c.slug,
          name: c.name,
          tier: c.tier,
          roles: c.roles ?? [],
          underrated: c.underrated,
        }))}
      />

      <Panel title="Recorded combinations" subtitle="highest model scores across all contexts" className="mt-6">
        <div className="space-y-2">
          {combinationRows.map((c) => {
            const a = c.analysis as {
              partyScore?: number;
              bestSingleScore?: number;
              estimatedDamageMultiplier?: number;
              estimatedMitigation?: number;
              conflicts?: { title: string }[];
              supportCoverage?: { role: string; covered: boolean }[];
            };
            return (
              <div key={c.hash} className="rounded border border-edge/60 bg-panel-2/30 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="data-font text-[10px] uppercase tracking-[0.15em] text-slate-600">{c.context}</span>
                  <ClassificationBadge value={c.classification} />
                  <span className="data-font ml-auto text-[11px] text-tactical">synergy {c.synergyScore}</span>
                  <span className="data-font text-[11px] text-slate-500">party {a.partyScore}</span>
                  <span className="data-font text-[11px] text-amber">+{c.synergyDelta}</span>
                </div>
                <div className="mt-1 text-[13px] font-medium text-slate-100">{c.memberSlugs.map(nameOf).join(" + ")}</div>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">{c.rationale}</p>
                <div className="data-font mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
                  <span>damage ×{a.estimatedDamageMultiplier}</span>
                  <span>resistance {Math.round((a.estimatedMitigation ?? 0) * 100)}%</span>
                  <span>coverage {(a.supportCoverage ?? []).filter((x) => x.covered).length}/6</span>
                  <span>{c.size} members</span>
                </div>
                {(a.conflicts ?? []).length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(a.conflicts ?? []).map((x) => (
                      <Tag key={x.title} tone="danger">
                        {x.title}
                      </Tag>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
