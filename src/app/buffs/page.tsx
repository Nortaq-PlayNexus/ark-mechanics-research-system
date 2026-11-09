import { db } from "@/db";
import { creatureBuffs } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { BUFFS } from "@/lib/ark";
import { analyseBuffPair } from "@/lib/engines/synergy";
import { BuffLab } from "@/components/BuffLab";
import { PageHeader, Panel, StatTile } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BuffLaboratoryPage() {
  await ensureSeeded();
  const relations = await db.select().from(creatureBuffs);

  const verdicts: Record<string, number> = {};
  for (let i = 0; i < BUFFS.length; i += 1) {
    for (let j = i; j < BUFFS.length; j += 1) {
      if (i === j && BUFFS[i].scope === "self") continue;
      const v = analyseBuffPair(BUFFS[i], BUFFS[j]).verdict;
      verdicts[v] = (verdicts[v] ?? 0) + 1;
    }
  }

  const documented = BUFFS.filter((b) => b.confidence === "documented").length;
  const noMagnitude = BUFFS.filter((b) => b.effects.every((e) => e.value === null)).length;

  const buffs = BUFFS.map((b) => ({
    slug: b.slug,
    name: b.name,
    kind: b.kind,
    category: b.category,
    scope: b.scope,
    sourceType: b.sourceType,
    effects: b.effects,
    stacking: b.stacking,
    exclusiveWith: b.exclusiveWith ?? [],
    durationSec: b.durationSec ?? null,
    notes: b.notes,
    confidence: b.confidence,
    providers: relations.filter((r) => r.buffSlug === b.slug && r.relation === "grants").map((r) => r.creatureSlug),
  })).sort((x, y) => x.name.localeCompare(y.name));

  return (
    <div>
      <PageHeader
        kicker="Section 05 · Buff Interaction Laboratory"
        title="Buff & Status Effect Research"
        subtitle="Every recorded effect with its modifier mode, stacking rule, exclusivity list, duration and provider. Where a magnitude is undocumented the platform records an unknown rather than inventing a number — those unknowns are the highest-priority experiments in the division."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Effects recorded" value={BUFFS.length} />
        <StatTile label="Documented" value={documented} accent="cool" hint={`${BUFFS.length - documented} community-reported or unverified`} />
        <StatTile label="No documented magnitude" value={noMagnitude} accent="amber" hint="excluded from all quantitative claims" />
        <StatTile label="Creature↔buff links" value={relations.length} accent="muted" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(verdicts).map(([verdict, count]) => (
          <StatTile key={verdict} label={verdict} value={count} accent={verdict === "stacks" ? "tactical" : verdict === "exclusive" ? "amber" : "muted"} />
        ))}
      </div>

      <div className="mt-4">
        <BuffLab buffs={buffs} />
      </div>

      <Panel title="Interaction matrix method" className="mt-4">
        <ol className="space-y-2 text-[12px] leading-relaxed text-slate-400">
          <li>1. Same effect from two sources is classified as stacking only if the effect is marked as stackable; otherwise it is a shared-source refresh.</li>
          <li>2. Effects explicitly marked exclusive are reported as overriding — only one applies.</li>
          <li>3. Two effects in the same category with complete stacking data are reported as parallel (non-compounding) bonuses pending confirmation.</li>
          <li>4. Two effects in the same category with incomplete data are reported as UNKNOWN — these drive the experiment queue.</li>
          <li>5. Effects in different categories are reported as expected to compound, subject to confirmation.</li>
        </ol>
      </Panel>
    </div>
  );
}
