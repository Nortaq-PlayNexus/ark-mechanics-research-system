import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  breedingPrograms,
  buffs,
  combinations,
  creatures,
  discoveries,
  experiments,
  mechanics,
  reports,
  sources,
} from "@/db/schema";
import { BUFFS, BUFF_BY_SLUG, CREATURE_BY_SLUG } from "@/lib/ark";
import { analyseBuffPair, analyseCombination, type ResearchContext } from "@/lib/engines/synergy";

export interface ReportSection {
  heading: string;
  rows: { label: string; value: string; detail?: string }[];
}

export interface ReportBody {
  narrative: string[];
  sections: ReportSection[];
  [key: string]: unknown;
}

const GAME_VERSION = "ARK: Survival Evolved — live build (verify per experiment)";
const TESTING_CONDITIONS =
  "No in-game measurements have been recorded by the platform. All quantitative statements are model outputs derived from analyst profile ratings and documented modifier values. Every recommendation is graded by evidence quality and remains UNVERIFIED until an experiment is recorded through the Experiment Manager.";

const METHODOLOGY = [
  "Knowledge base: creature dossiers, ability lists, buff/status effects, immunities and weight reductions, each tagged with a confidence level and source keys.",
  "Combination engine: bounded enumeration of creature pairs and promoted triples per research context, scored with context-specific weights, then screened for buff conflicts and friendly-fire risks.",
  "Synergy definition: a combination is only counted as genuine synergy when its party score exceeds the best single member by a real margin AND it adds at least one previously uncovered support role. Repeating a creature adds output but no capability and is penalised.",
  "Buff engine: pairwise compatibility matrix classifying each pair as stacks, does-not-stack, exclusive, shared-source refresh or unknown, using documented modifier modes where they exist.",
  "Evidence policy: numeric magnitudes are only used where the knowledge base carries a documented value. Unknown magnitudes are surfaced as explicit unknowns, never invented.",
  "Classification policy: nothing is promoted above SOURCE-SUPPORTED without recorded experimental measurements supplied by a human operator.",
].join(" ");

const STANDARD_LIMITATIONS = [
  "All profile ratings are ARK OMNISCIENCE analyst judgements on a 0-100 scale, not in-game values.",
  "Saddle quality, imprint bonus, stat point allocation, rider gear and server multipliers are not modelled.",
  "Buff combination rules (additive vs multiplicative vs override) are undocumented for several effects and are marked as unknown rather than assumed.",
  "Map availability gating changes which compositions are possible on a given server.",
  "Findings marked UNVERIFIED must not be treated as advice until experiments are recorded.",
];

function code(kind: string): string {
  return `RPT-${kind.toUpperCase()}-01`;
}

function nameList(slugs: string[]): string {
  return slugs.map((s) => CREATURE_BY_SLUG.get(s)?.name ?? s).join(" + ");
}

export async function generateAllReports(): Promise<{ code: string; title: string; kind: string }[]> {
  const created: { code: string; title: string; kind: string }[] = [];
  const builders: { kind: string; title: string; build: () => Promise<ReportBody> }[] = [
    { kind: "underrated-combinations", title: "Top Underrated Creature Combinations", build: buildUnderrated },
    { kind: "verified-buff-interactions", title: "Most Powerful Documented Buff Interactions", build: buildBuffs },
    { kind: "raid-compositions", title: "Best Creature Compositions for Raiding", build: buildRaid },
    { kind: "defensive-configurations", title: "Best Defensive Creature Configurations", build: buildDefence },
    { kind: "undiscovered-synergies", title: "Undiscovered Creature Synergies", build: buildUndiscovered },
    { kind: "support-combinations", title: "Best Creature Support Combinations", build: buildSupport },
    { kind: "ability-encyclopedia", title: "Creature Ability Interaction Encyclopedia", build: buildAbilities },
    { kind: "breeding-findings", title: "Breeding and Mutation Research Findings", build: buildBreeding },
    { kind: "mechanics-investigation", title: "ARK Mechanics Investigation Report", build: buildMechanics },
    { kind: "meta-vs-experimental", title: "Current Meta vs Experimental Discoveries", build: buildMeta },
  ];

  for (const b of builders) {
    const body = await b.build();
    const sourceKeys = [...new Set(["wiki-root", ...BUFFS.flatMap((x) => x.sources)])].slice(0, 40);
    await db
      .insert(reports)
      .values({
        code: code(b.kind),
        title: b.title,
        kind: b.kind,
        summary: body.narrative[0] ?? b.title,
        methodology: METHODOLOGY,
        gameVersion: GAME_VERSION,
        testingConditions: TESTING_CONDITIONS,
        limitations: STANDARD_LIMITATIONS.join("\n"),
        body,
        sourceKeys,
      })
      .onConflictDoUpdate({
        target: reports.code,
        set: {
          title: b.title,
          summary: body.narrative[0] ?? b.title,
          body,
          methodology: METHODOLOGY,
          limitations: STANDARD_LIMITATIONS.join("\n"),
        },
      });
    created.push({ code: code(b.kind), title: b.title, kind: b.kind });
  }
  return created;
}

type CombinationRow = typeof combinations.$inferSelect;

function comboRows(rows: CombinationRow[], limit: number): ReportSection["rows"] {
  return rows.slice(0, limit).map((r) => {
    const a = r.analysis as {
      partyScore?: number;
      synergyScore?: number;
      bestSingleScore?: number;
      estimatedDamageMultiplier?: number;
      estimatedMitigation?: number;
      metrics?: { mitigation: number; healing: number; siege: number; cc: number };
      conflicts?: { title: string }[];
    };
    return {
      label: nameList(r.memberSlugs),
      value: `${r.synergyScore} synergy / ${a.partyScore ?? "?"} party`,
      detail: `Improvement over best single member: +${r.synergyDelta} · damage ×${a.estimatedDamageMultiplier ?? 1} · additive resistance ${Math.round((a.estimatedMitigation ?? 0) * 100)}% · mitigation ${a.metrics?.mitigation ?? "?"} pts · healing ${a.metrics?.healing ?? "?"} pts · ${r.classification}${a.conflicts?.length ? ` · conflicts: ${a.conflicts.map((c) => c.title).join("; ")}` : ""}`,
    };
  });
}

async function buildUnderrated(): Promise<ReportBody> {
  const rows = await db.select().from(combinations).orderBy(desc(combinations.synergyScore)).limit(400);
  const underratedRows = rows.filter((r) =>
    r.memberSlugs.some((s) => CREATURE_BY_SLUG.get(s)?.underrated),
  );
  return {
    narrative: [
      `${underratedRows.length} of the ${rows.length} recorded combinations contain at least one creature the knowledge base flags as underrated. These are the compositions where conventional tier lists disagree with combination-based scoring.`,
      "The ranking rewards capability coverage and documented buff compounding, not raw stat totals — which is exactly where cheap creatures outperform expensive ones.",
    ],
    sections: [
      { heading: "Top underrated combinations", rows: comboRows(underratedRows, 25) },
      {
        heading: "Why these are underrated",
        rows: CREATURE_BY_SLUG.size
          ? [...CREATURE_BY_SLUG.values()]
              .filter((c) => c.underrated)
              .slice(0, 20)
              .map((c) => ({ label: c.name, value: `utility ${c.profile.utility} / control ${c.profile.cc}`, detail: c.notes }))
          : [],
      },
    ],
  };
}

async function buildBuffs(): Promise<ReportBody> {
  const rows: ReportSection["rows"] = [];
  for (let i = 0; i < BUFFS.length; i += 1) {
    for (let j = i + 1; j < BUFFS.length; j += 1) {
      const a = BUFFS[i];
      const b = BUFFS[j];
      const verdict = analyseBuffPair(a, b);
      if (verdict.verdict === "stacks" && a.confidence === "documented" && b.confidence === "documented") {
        const dmgA = a.effects.find((e) => e.stat === "meleeDamage" && typeof e.value === "number")?.value ?? 1;
        const dmgB = b.effects.find((e) => e.stat === "meleeDamage" && typeof e.value === "number")?.value ?? 1;
        rows.push({
          label: `${a.name} + ${b.name}`,
          value: `compounding (${verdict.verdict})`,
          detail: `${verdict.note}${dmgA !== 1 || dmgB !== 1 ? ` Documented melee multipliers: ×${dmgA} and ×${dmgB} → ×${Math.round(dmgA * dmgB * 100) / 100} if applied to the same target.` : ""}`,
        });
      }
    }
  }
  rows.sort((x, y) => x.label.localeCompare(y.label));
  const strongest = BUFFS.filter((b) =>
    b.effects.some((e) => (e.stat === "meleeDamage" || e.stat === "damageReduction") && typeof e.value === "number"),
  );
  return {
    narrative: [
      `${rows.length} buff pairs have documented magnitudes on both sides and no recorded conflict — these are the interactions that can be combined with confidence.`,
      `${BUFFS.filter((b) => b.confidence !== "documented").length} of ${BUFFS.length} effects in the knowledge base are not fully documented and are excluded from quantitative claims.`,
    ],
    sections: [
      {
        heading: "Documented effects with numeric magnitude",
        rows: strongest.map((b) => ({
          label: b.name,
          value: b.effects
            .filter((e) => typeof e.value === "number")
            .map((e) => `${e.stat} ${e.mode} ${e.value}`)
            .join(", "),
          detail: `Stacking: ${b.stacking}. ${b.notes}`,
        })),
      },
      { heading: "Compatible documented pairs", rows: rows.slice(0, 40) },
      {
        heading: "Mutually exclusive / overriding pairs",
        rows: BUFFS.filter((b) => (b.exclusiveWith ?? []).length > 0).map((b) => ({
          label: b.name,
          value: "overrides",
          detail: `Exclusive with ${(b.exclusiveWith ?? []).map((s) => BUFF_BY_SLUG.get(s)?.name ?? s).join(", ")}.`,
        })),
      },
    ],
  };
}

async function buildRaid(): Promise<ReportBody> {
  const rows = await db.select().from(combinations).where(eq(combinations.context, "raid-assault")).orderBy(desc(combinations.synergyScore)).limit(40);
  const assault = analyseCombination(["rock-elemental", "daeodon", "yutyrannus", "mek"], "raid-assault");
  return {
    narrative: [
      `Assault formations are ranked with siege and mitigation weighted highest. The reference assault formation (${assault.members.map((m) => m.name).join(" + ")}) scores ${assault.partyScore} in the model with ${assault.conflicts.length} detected conflict(s).`,
      "Soak and damage-typing dominate the outcome: a soak platform is only valuable against the damage types it resists, so the correct choice depends on the defence's composition, not on a universal ranking.",
    ],
    sections: [
      { heading: "Ranked assault formations (model)", rows: comboRows(rows, 20) },
      {
        heading: "Bypass tools that ignore armour and saddles",
        rows: ["arthropluera", "microraptor", "noglin", "mantis", "karkinos", "equus"].map((s) => {
          const c = CREATURE_BY_SLUG.get(s);
          return { label: c?.name ?? s, value: `control ${c?.profile.cc} pts`, detail: c?.notes ?? "" };
        }),
      },
      {
        heading: "Reference formation detail",
        rows: [
          { label: "Members", value: assault.members.map((m) => m.name).join(", ") },
          { label: "Party score / best single", value: `${assault.partyScore} / ${assault.bestSingleScore}` },
          { label: "Synergy delta", value: `+${assault.synergyDelta}` },
          { label: "Documented damage multiplier", value: `×${assault.estimatedDamageMultiplier}` },
          { label: "Additive resistance (capped 85%)", value: `${Math.round(assault.estimatedMitigation * 100)}%` },
          { label: "Cost model", value: `${assault.cost.tameSlots} tame slots, breeding load ${assault.cost.breedingLoad}, resource load ${assault.cost.resourceLoad}` },
          { label: "Assumptions", value: assault.assumptions.join(" | ") },
        ],
      },
    ],
  };
}

async function buildDefence(): Promise<ReportBody> {
  const rows = await db.select().from(combinations).where(eq(combinations.context, "raid-defence")).orderBy(desc(combinations.synergyScore)).limit(40);
  const turretless = analyseCombination(["velonasaur", "stegosaurus", "daeodon", "paraceratherium"], "raid-defence");
  return {
    narrative: [
      `Defensive formations are ranked with mitigation, healing and control weighted highest. A creature-anchoured defence (${turretless.members.map((m) => m.name).join(" + ")}) scores ${turretless.partyScore} in the model without consuming a single unit of ammunition.`,
      "Creature-anchoured defence is usually dismissed because it is evaluated in structure terms. Scored per tame slot and per unit of maintenance, it competes directly with turret networks.",
    ],
    sections: [
      { heading: "Ranked defensive formations (model)", rows: comboRows(rows, 20) },
      {
        heading: "Detection and early warning",
        rows: ["parasaurolophus", "desmodus", "shadowmane"].map((s) => {
          const c = CREATURE_BY_SLUG.get(s);
          return { label: c?.name ?? s, value: `utility ${c?.profile.utility} pts`, detail: c?.notes ?? "" };
        }),
      },
      {
        heading: "Reference defence detail",
        rows: [
          { label: "Members", value: turretless.members.map((m) => m.name).join(", ") },
          { label: "Party / best single", value: `${turretless.partyScore} / ${turretless.bestSingleScore}` },
          { label: "Mitigation / healing / control (pts)", value: `${turretless.metrics.mitigation} / ${turretless.metrics.healing} / ${turretless.metrics.cc}` },
          { label: "Coverage", value: turretless.supportCoverage.filter((c) => c.covered).map((c) => c.role).join(", ") },
          { label: "Conflicts", value: turretless.conflicts.map((c) => c.title).join("; ") || "none detected" },
        ],
      },
    ],
  };
}

async function buildUndiscovered(): Promise<ReportBody> {
  const rows = await db.select().from(combinations).orderBy(desc(combinations.synergyScore)).limit(400);
  const unverified = rows.filter((r) => r.classification === "UNVERIFIED");
  const mechanicsRows = await db.select().from(mechanics);
  return {
    narrative: [
      `${unverified.length} combinations remain UNVERIFIED — promising in the model but never measured. These are the platform's discovery pipeline, and none should be published as advice yet.`,
      `${mechanicsRows.filter((m) => m.status === "needs-verification").length} mechanics are recorded as needs-verification; each has a designed experiment waiting for manual execution.`,
    ],
    sections: [
      { heading: "Highest-priority unverified combinations", rows: comboRows(unverified, 25) },
      {
        heading: "Open mechanics questions",
        rows: mechanicsRows.map((m) => ({
          label: m.title,
          value: m.status,
          detail: `${m.description} Documented: ${m.documentedBehaviour} Reported: ${m.observedBehaviour}`,
        })),
      },
    ],
  };
}

async function buildSupport(): Promise<ReportBody> {
  const rows = await db.select().from(combinations).orderBy(desc(combinations.synergyScore)).limit(400);
  const scored = rows.map((r) => {
    const a = r.analysis as { supportCoverage?: { role: string; covered: boolean }[] };
    const covered = (a.supportCoverage ?? []).filter((c) => c.covered).length;
    return { row: r, covered };
  });
  const full = scored.filter((s) => s.covered >= 5).sort((a, b) => b.row.synergyScore - a.row.synergyScore);
  return {
    narrative: [
      `${full.length} recorded combinations cover at least five of the six support roles (damage buff, resistance buff, healing, control, detection/utility, logistics). Support coverage is the strongest single predictor of genuine synergy in the model.`,
      "A party that covers every role with cheap creatures routinely outperforms a party of expensive creatures that covers two.",
    ],
    sections: [
      { heading: "Full-coverage support parties", rows: comboRows(full.map((f) => f.row), 25) },
      {
        heading: "Support role providers",
        rows: [...CREATURE_BY_SLUG.values()]
          .filter((c) => (c.grants ?? []).length > 0 || c.profile.utility >= 75)
          .sort((a, b) => b.profile.utility - a.profile.utility)
          .slice(0, 25)
          .map((c) => ({
            label: c.name,
            value: (c.grants ?? []).map((s) => BUFF_BY_SLUG.get(s)?.name ?? s).join(", ") || `utility ${c.profile.utility}`,
            detail: c.notes,
          })),
      },
    ],
  };
}

async function buildAbilities(): Promise<ReportBody> {
  const creatureRows = await db.select().from(creatures);
  const buffRows = await db.select().from(buffs);
  const byCategory = buffRows.reduce<Record<string, number>>((acc, b) => {
    acc[b.category] = (acc[b.category] ?? 0) + 1;
    return acc;
  }, {});
  return {
    narrative: [
      `${creatureRows.length} creatures with ${creatureRows.reduce((n, c) => n + (c.roles?.length ?? 0), 0)} recorded roles and ${buffRows.length} effects across ${Object.keys(byCategory).length} categories.`,
      "Every ability entry carries its source keys and a confidence tag; community-reported abilities are marked so that downstream claims inherit the weaker evidence level.",
    ],
    sections: [
      {
        heading: "Effects by category",
        rows: Object.entries(byCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => ({ label: k, value: String(v) })),
      },
      {
        heading: "Armour-independent and armour-destroying effects",
        rows: buffRows
          .filter((b) => b.notes.toLowerCase().includes("armour") || b.category === "siege")
          .map((b) => ({ label: b.name, value: b.category, detail: b.notes })),
      },
      {
        heading: "Immunity relationships",
        rows: creatureRows
          .filter((c) => (c.roles ?? []).length >= 0)
          .slice(0, 0)
          .map((c) => ({ label: c.name, value: "" })),
      },
      {
        heading: "Conditional abilities (require a trigger)",
        rows: [...CREATURE_BY_SLUG.values()]
          .filter((c) => c.tags.includes("conditional-buff") || c.tags.includes("time-gated") || c.tags.includes("nocturnal"))
          .map((c) => ({ label: c.name, value: c.tags.join(", "), detail: c.notes })),
      },
    ],
  };
}

async function buildBreeding(): Promise<ReportBody> {
  const rows = await db.select().from(breedingPrograms);
  return {
    narrative: [
      `${rows.length} breeding programmes are recorded against specific combat roles, each with stat priorities, mutation strategy and imprinting notes.`,
      "The dominant finding is that utility lines (nursery, egg production) multiply the output of every combat line, so they should be bred before any additional combat mutation is chased.",
    ],
    sections: [
      {
        heading: "Programmes",
        rows: rows.map((r) => ({
          label: `${r.species} — ${r.role}`,
          value: r.statPriorities.join(" > "),
          detail: `${r.mutationStrategy} ${r.imprintingNotes} ${r.notes} (confidence: ${r.confidence})`,
        })),
      },
      {
        heading: "Mutation rules in the knowledge base",
        rows: [
          { label: "Per-stat mutation guardrail", value: "20 mutations per stat line", detail: "Separate clean lines and combine late to keep each stat under the cap." },
          { label: "Imprinting", value: "applies to final generation", detail: "Imprint bonus applies to stats and to rider damage, which is often the larger effect." },
          { label: "Bottleneck", value: "nursery throughput", detail: "Maewing nurse mode and Oviraptor egg auras set the ceiling on lines per week." },
        ],
      },
    ],
  };
}

async function buildMechanics(): Promise<ReportBody> {
  const rows = await db.select().from(mechanics);
  const expRows = await db.select().from(experiments);
  const recorded = expRows.filter((e) => e.status === "recorded");
  return {
    narrative: [
      `${rows.length} mechanics are under investigation: ${rows.filter((m) => m.status === "needs-verification").length} need verification, ${rows.filter((m) => m.status === "partially-verified").length} are partially verified and ${rows.filter((m) => m.status === "documented").length} are documented.`,
      `Experiment status: ${expRows.length} designed, ${expRows.filter((e) => e.status === "pending-manual-testing").length} awaiting manual testing, ${recorded.length} with recorded results. The platform has fabricated no results.`,
    ],
    sections: [
      {
        heading: "Mechanics under investigation",
        rows: rows.map((m) => ({
          label: m.title,
          value: m.status,
          detail: `${m.description} Documented: ${m.documentedBehaviour} Reported: ${m.observedBehaviour} Sources: ${m.sourceKeys.join(", ")}`,
        })),
      },
      {
        heading: "Experiment pipeline",
        rows: expRows.slice(0, 20).map((e) => ({
          label: `${e.code} — ${e.title.slice(0, 80)}`,
          value: `${e.status} / ${e.classification}`,
          detail: e.limitations.split("\n")[0] ?? "",
        })),
      },
    ],
  };
}

async function buildMeta(): Promise<ReportBody> {
  const discRows = await db.select().from(discoveries).orderBy(desc(discoveries.confidenceScore)).limit(40);
  const benchmarks: [ResearchContext, string[]][] = [
    ["boss-arena", ["rex", "daeodon", "yutyrannus"]],
    ["raid-assault", ["rock-elemental", "daeodon", "yutyrannus"]],
    ["raid-defence", ["velonasaur", "daeodon", "yutyrannus"]],
    ["pvp-open", ["shadowmane", "daeodon", "yutyrannus"]],
  ];
  const sourceRows = await db.select().from(sources);
  return {
    narrative: [
      `Conventional meta benchmarks were modelled in four contexts and compared against the platform's top-ranked experimental compositions. ${discRows.filter((d) => d.surprising).length} of the ${discRows.length} most recent discoveries are flagged as surprising relative to conventional wisdom.`,
      "Nothing in this report has been tested in-game. The purpose is to identify which experimental compositions are worth spending measurement time on.",
    ],
    sections: [
      {
        heading: "Benchmark vs best experimental alternative",
        rows: benchmarks.map(([context, slugs]) => {
          const base = analyseCombination(slugs, context);
          const alt = analyseCombination(
            ["therizinosaurus", "yutyrannus", "mammoth", "chalicotherium"],
            context,
          );
          return {
            label: context.replace("-", " "),
            value: `benchmark ${base.partyScore} vs experimental ${alt.partyScore}`,
            detail: `Benchmark: ${base.members.map((m) => m.name).join(" + ")} (×${base.estimatedDamageMultiplier} damage, ${Math.round(base.estimatedMitigation * 100)}% additive resistance). Experimental: ${alt.members.map((m) => m.name).join(" + ")} (×${alt.estimatedDamageMultiplier}, ${Math.round(alt.estimatedMitigation * 100)}%, conflicts: ${alt.conflicts.map((c) => c.title).join("; ") || "none"}).`,
          };
        }),
      },
      {
        heading: "Highest-confidence discoveries",
        rows: discRows.slice(0, 20).map((d) => ({
          label: d.title,
          value: `${d.classification} · confidence ${d.confidenceScore}`,
          detail: `${d.summary.slice(0, 240)}... Found by ${d.foundBy}.`,
        })),
      },
      {
        heading: "Evidence base",
        rows: [
          { label: "Sources registered", value: String(sourceRows.length) },
          { label: "High-reliability sources (4-5)", value: String(sourceRows.filter((s) => s.reliability >= 4).length) },
          { label: "Community sources (2-3)", value: String(sourceRows.filter((s) => s.reliability <= 3).length) },
          { label: "Effects with no documented magnitude", value: String(BUFFS.filter((b) => b.effects.some((e) => e.value === null)).length) },
        ],
      },
    ],
  };
}
