import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { combinations } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { analyseCombination, type ResearchContext } from "@/lib/engines/synergy";
import { CREATURE_BY_SLUG } from "@/lib/ark";
import { ClassificationBadge, KeyValue, PageHeader, Panel, StatTile, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

const SOAK = ["rock-elemental", "titanosaur", "doedicurus", "stegosaurus", "paraceratherium", "reaper-king"];
const SIEGE = ["mek", "titanosaur", "giganotosaurus", "phoenix", "arthropluera", "rock-elemental"];
const BYPASS = ["arthropluera", "microraptor", "noglin", "mantis", "karkinos", "equus", "kaprosuchus"];

export default async function RaidIntelligencePage() {
  await ensureSeeded();
  const [assault, defence] = await Promise.all([
    db.select().from(combinations).where(eq(combinations.context, "raid-assault")).orderBy(desc(combinations.synergyScore)).limit(12),
    db.select().from(combinations).where(eq(combinations.context, "raid-defence")).orderBy(desc(combinations.synergyScore)).limit(12),
  ]);

  const reference = analyseCombination(["rock-elemental", "daeodon", "yutyrannus", "mek"], "raid-assault");
  const defenceRef = analyseCombination(["velonasaur", "stegosaurus", "daeodon", "paraceratherium"], "raid-defence");
  const herbLine = analyseCombination(["therizinosaurus", "triceratops", "mammoth", "chalicotherium"], "raid-assault");

  return (
    <div>
      <PageHeader
        kicker="Section 07 · Raid Intelligence"
        title="Offensive & Defensive Raid Research"
        subtitle="Raid formations are scored with siege and mitigation weighted highest, then screened for healing-channel conflicts (Sweet Vegetable Cake heals herbivores only) and for damage-typing mismatches: a soak platform is only worth its slot against the damage types it actually resists."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Assault formations ranked" value={assault.length} />
        <StatTile label="Defensive formations ranked" value={defence.length} accent="cool" />
        <StatTile label="Reference assault party score" value={reference.partyScore} accent="amber" hint={reference.members.map((m) => m.name).join(" + ")} />
        <StatTile label="Herbivore front-line score" value={herbLine.partyScore} hint="cake-sustained, no Daeodon food drain" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Reference assault formation" subtitle="model output">
          <h3 className="text-[14px] font-medium text-white">{reference.members.map((m) => m.name).join(" + ")}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{reference.rationale}</p>
          <div className="mt-3">
            <KeyValue
              items={[
                { label: "Party score", value: `${reference.partyScore} (best single ${reference.bestSingleScore})` },
                { label: "Synergy score", value: `${reference.synergyScore} (delta +${reference.synergyDelta})` },
                { label: "Siege capability", value: `${reference.metrics.siege} pts` },
                { label: "Mitigation", value: `${reference.metrics.mitigation} pts` },
                { label: "Documented damage multiplier", value: `×${reference.estimatedDamageMultiplier}` },
                { label: "Additive resistance (cap 85%)", value: `${Math.round(reference.estimatedMitigation * 100)}%` },
                { label: "Cost", value: `${reference.cost.tameSlots} slots · breeding load ${reference.cost.breedingLoad}` },
                { label: "Classification", value: <ClassificationBadge value={reference.classification} /> },
              ]}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {reference.conflicts.map((c) => (
              <Tag key={c.title} tone="danger">
                {c.title}
              </Tag>
            ))}
          </div>
        </Panel>

        <Panel title="Reference defensive formation" subtitle="creature-anchoured, no ammunition">
          <h3 className="text-[14px] font-medium text-white">{defenceRef.members.map((m) => m.name).join(" + ")}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{defenceRef.rationale}</p>
          <div className="mt-3">
            <KeyValue
              items={[
                { label: "Party score", value: `${defenceRef.partyScore} (best single ${defenceRef.bestSingleScore})` },
                { label: "Mitigation / healing / control", value: `${defenceRef.metrics.mitigation} / ${defenceRef.metrics.healing} / ${defenceRef.metrics.cc} pts` },
                { label: "Coverage", value: defenceRef.supportCoverage.filter((c) => c.covered).map((c) => c.role).join(", ") },
                { label: "Conflicts", value: defenceRef.conflicts.map((c) => c.title).join("; ") || "none detected" },
                { label: "Cost", value: `${defenceRef.cost.tameSlots} slots · breeding load ${defenceRef.cost.breedingLoad}` },
              ]}
            />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Soak platforms" subtitle="damage-typing dependent">
          <ul className="space-y-2">
            {SOAK.map((s) => {
              const c = CREATURE_BY_SLUG.get(s);
              if (!c) return null;
              return (
                <li key={s} className="rounded border border-edge/60 bg-panel-2/30 p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-slate-100">{c.name}</span>
                    <span className="data-font ml-auto text-[11px] text-cool">{c.profile.mitigation} mitigation</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-400">{c.notes}</p>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Siege capability" subtitle="structure damage">
          <ul className="space-y-2">
            {SIEGE.map((s) => {
              const c = CREATURE_BY_SLUG.get(s);
              if (!c) return null;
              return (
                <li key={s} className="rounded border border-edge/60 bg-panel-2/30 p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-slate-100">{c.name}</span>
                    <span className="data-font ml-auto text-[11px] text-danger">{c.profile.siege} siege</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-400">{c.notes}</p>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Bypass tools" subtitle="ignore armour, saddles or rider agency">
          <ul className="space-y-2">
            {BYPASS.map((s) => {
              const c = CREATURE_BY_SLUG.get(s);
              if (!c) return null;
              return (
                <li key={s} className="rounded border border-edge/60 bg-panel-2/30 p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-slate-100">{c.name}</span>
                    <span className="data-font ml-auto text-[11px] text-amber">{c.profile.cc} control</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-400">{c.notes}</p>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[
          { title: "Top assault formations", rows: assault, context: "raid-assault" as ResearchContext },
          { title: "Top defensive formations", rows: defence, context: "raid-defence" as ResearchContext },
        ].map((block) => (
          <Panel key={block.title} title={block.title} subtitle="model ranked">
            <div className="space-y-2">
              {block.rows.map((r) => {
                const a = r.analysis as { partyScore?: number; estimatedDamageMultiplier?: number; estimatedMitigation?: number };
                return (
                  <div key={r.hash} className="rounded border border-edge/60 bg-panel-2/30 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] text-slate-100">{r.memberSlugs.map((s) => CREATURE_BY_SLUG.get(s)?.name ?? s).join(" + ")}</span>
                      <span className="data-font ml-auto text-[11px] text-tactical">{r.synergyScore}</span>
                      <span className="data-font text-[10px] text-slate-500">party {a.partyScore}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">{r.rationale}</p>
                  </div>
                );
              })}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
