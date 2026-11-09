import { db } from "@/db";
import { bosses } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { analyseCombination } from "@/lib/engines/synergy";
import { CREATURE_BY_SLUG } from "@/lib/ark";
import { ClassificationBadge, KeyValue, PageHeader, Panel, StatTile, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PveBossPage() {
  await ensureSeeded();
  const bossRows = await db.select().from(bosses);

  const analyses = bossRows.map((b) => ({ boss: b, analysis: analyseCombination(b.recommendedSlugs, "boss-arena") }));

  return (
    <div>
      <PageHeader
        kicker="Section 09 · PvE & Boss Research"
        title="Boss Composition & Arena Constraint Research"
        subtitle="Arena restrictions are applied before composition optimisation: radiation immunity, no-fly rules and flying bosses each eliminate most of the roster before combat statistics matter. Sustain throughput is weighted above raw HP because most boss damage is percentage-based over time."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Bosses researched" value={bossRows.length} />
        <StatTile label="Arena restrictions catalogued" value={bossRows.reduce((n, b) => n + b.restrictions.length, 0)} accent="cool" />
        <StatTile label="Average recommended party score" value={Math.round((analyses.reduce((n, a) => n + a.analysis.partyScore, 0) / (analyses.length || 1)) * 10) / 10} accent="amber" />
        <StatTile label="Compositions with underrated members" value={analyses.filter((a) => a.analysis.members.some((m) => m.underrated)).length} accent="muted" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {analyses.map(({ boss, analysis }) => (
          <Panel key={boss.slug} title={boss.name} subtitle={boss.difficulty}>
            <p className="text-[12px] leading-relaxed text-slate-400">{boss.notes}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {boss.restrictions.map((r) => (
                <Tag key={r} tone="danger">
                  {r}
                </Tag>
              ))}
              {boss.counters.map((c) => (
                <Tag key={c} tone="cool">
                  {c}
                </Tag>
              ))}
            </div>
            <div className="mt-3">
              <KeyValue
                items={[
                  { label: "Arena", value: boss.arena },
                  { label: "Recommended", value: analysis.members.map((m) => m.name).join(", ") },
                  { label: "Party score", value: `${analysis.partyScore} (best single ${analysis.bestSingleScore})` },
                  { label: "Damage / healing", value: `${analysis.metrics.damage} / ${analysis.metrics.healing} pts` },
                  { label: "Documented damage multiplier", value: `×${analysis.estimatedDamageMultiplier}` },
                  { label: "Conflicts", value: analysis.conflicts.map((c) => c.title).join("; ") || "none detected" },
                  { label: "Classification", value: <ClassificationBadge value={analysis.classification} /> },
                  { label: "Contains underrated creatures", value: analysis.members.some((m) => m.underrated) ? "yes" : "no" },
                ]}
              />
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="Constraint-first methodology" className="mt-4">
        <ol className="space-y-2 text-[12px] leading-relaxed text-slate-400">
          <li>1. Filter the roster by hard arena constraints (radiation, flight, creature count, platform saddles).</li>
          <li>2. Score survivors with boss-arena weights: damage 1.6, mitigation 1.3, healing 1.5, control 0.4, mobility 0.4.</li>
          <li>3. Require sustain throughput: percentage-based breath and area damage makes healing worth more than raw HP.</li>
          <li>4. Prefer armour-independent damage (bleed) where boss armour or resistance reduces conventional melee.</li>
          <li>5. Compare against the conventional Rex + Daeodon + Yuty benchmark at the same difficulty before recommending.</li>
          <li>6. Record time-to-kill, damage taken and creatures lost — success/failure alone is not a measurement.</li>
        </ol>
        <p className="data-font mt-3 text-[10px] text-slate-600">
          Recommendation source pool: {bossRows.map((b) => b.recommendedSlugs.map((s) => CREATURE_BY_SLUG.get(s)?.name ?? s).join(" / ")).slice(0, 400)}…
        </p>
      </Panel>
    </div>
  );
}
