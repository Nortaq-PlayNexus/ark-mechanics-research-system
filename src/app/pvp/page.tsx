import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { combinations, discoveries } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { analyseCombination } from "@/lib/engines/synergy";
import { BUFFS, CREATURES, CREATURE_BY_SLUG } from "@/lib/ark";
import { ClassificationBadge, PageHeader, Panel, StatTile, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PvpResearchPage() {
  await ensureSeeded();
  const [discoveryRows, combinationRows] = await Promise.all([
    db.select().from(discoveries).orderBy(desc(discoveries.confidenceScore)).limit(300),
    db.select().from(combinations).where(eq(combinations.context, "pvp-open")).orderBy(desc(combinations.synergyScore)).limit(12),
  ]);

  const control = CREATURES.filter((c) => c.profile.cc >= 70).sort((a, b) => a.profile.cc - b.profile.cc);
  const meta = ["rex", "giganotosaurus", "shadowmane", "managarmr", "rock-drake", "reaper-king"];
  const armourBypass = BUFFS.filter((b) => b.notes.toLowerCase().includes("armour") || b.category === "siege");
  const controlChain = analyseCombination(["microraptor", "managarmr", "daeodon", "yutyrannus"], "pvp-open");
  const pvpFindings = discoveryRows.filter((d) => d.domain === "pvp-meta" || d.domain === "meta-analysis");

  return (
    <div>
      <PageHeader
        kicker="Section 08 · PvP Research"
        title="PvP Meta & Counter Investigation"
        subtitle="Open-field PvP is scored with control and mobility weighted above raw damage. The central finding: against mutated, ascendant-saddled lines, armour-independent damage and rider-removal effects are worth more per tame slot than additional melee — and they cost a fraction of the breeding time."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Control creatures identified" value={control.length} hint="control rating 70+" />
        <StatTile label="Armour-independent effects" value={armourBypass.length} accent="amber" />
        <StatTile label="Control-chain party score" value={controlChain.partyScore} accent="cool" />
        <StatTile label="PvP findings recorded" value={pvpFindings.length} accent="muted" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Counter matrix" subtitle="low-cost control vs conventional meta">
          <div className="space-y-2">
            {control.slice(0, 10).map((c) => (
              <div key={c.slug} className="rounded border border-edge/60 bg-panel-2/30 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-medium text-slate-100">{c.name}</span>
                  <Tag>{c.tier}</Tag>
                  <span className="data-font ml-auto text-[11px] text-amber">control {c.profile.cc}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">{c.notes}</p>
                <div className="data-font mt-1 text-[10px] text-slate-600">
                  counters: {meta.filter((m) => CREATURE_BY_SLUG.has(m)).map((m) => CREATURE_BY_SLUG.get(m)!.name).join(", ")}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Armour-independent damage sources">
            <ul className="space-y-2">
              {armourBypass.map((b) => (
                <li key={b.slug} className="rounded border border-edge/60 bg-panel-2/30 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-medium text-slate-100">{b.name}</span>
                    <Tag tone={b.confidence === "documented" ? "tactical" : "amber"}>{b.confidence}</Tag>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-400">{b.notes}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Control-chain composition" subtitle="slow or dismount first, then damage">
            <h3 className="text-[14px] font-medium text-white">{controlChain.members.map((m) => m.name).join(" + ")}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{controlChain.rationale}</p>
            <div className="data-font mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
              <span>party {controlChain.partyScore}</span>
              <span>synergy {controlChain.synergyScore}</span>
              <span>control {controlChain.metrics.cc} pts</span>
              <span>damage ×{controlChain.estimatedDamageMultiplier}</span>
              <span>resistance {Math.round(controlChain.estimatedMitigation * 100)}%</span>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Top open-field PvP compositions" subtitle="model ranked" className="mt-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {combinationRows.map((r) => {
            const a = r.analysis as { partyScore?: number };
            return (
              <div key={r.hash} className="rounded border border-edge/60 bg-panel-2/30 p-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-slate-100">{r.memberSlugs.map((s) => CREATURE_BY_SLUG.get(s)?.name ?? s).join(" + ")}</span>
                  <span className="data-font ml-auto text-[11px] text-tactical">{r.synergyScore}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">{r.rationale}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="PvP research findings" className="mt-4">
        <div className="space-y-3">
          {pvpFindings.slice(0, 10).map((d) => (
            <div key={d.code} className="rounded border border-edge/60 bg-panel-2/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <ClassificationBadge value={d.classification} />
                <span className="data-font text-[10px] text-slate-600">{d.foundBy}</span>
                <span className="data-font ml-auto text-[10px] text-slate-500">confidence {d.confidenceScore}</span>
              </div>
              <p className="mt-1 text-[13px] font-medium text-slate-100">{d.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{d.summary}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
