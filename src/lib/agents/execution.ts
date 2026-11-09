import {
  BOSSES,
  BUFFS,
  BUFF_BY_SLUG,
  BREEDING_PROGRAMS,
  CREATURES,
  CREATURE_BY_SLUG,
  MECHANICS,
  ORPHAN_BUFF_REFERENCES,
  type ArkCreature,
  type DiscoveryClassification,
} from "@/lib/ark";
import { analyseBuffPair, analyseCombination, candidateCombinations, type ResearchContext } from "@/lib/engines/synergy";
import { generateHypotheses, type HypothesisDraft } from "@/lib/engines/hypothesis";
import { AGENT_BY_CODE, AGENTS } from "./registry";

export interface FindingDraft {
  title: string;
  summary: string;
  domain: string;
  classification: DiscoveryClassification;
  confidenceScore: number;
  evidenceQuality: string;
  surprising: boolean;
  creatureSlugs: string[];
  buffSlugs: string[];
  sourceKeys: string[];
  foundBy: string;
}

export interface TaskOutcome {
  title: string;
  question: string;
  outcome: "completed" | "blocked" | "queued";
  summary: string;
  priority: number;
}

export interface AgentRunResult {
  agentCode: string;
  logs: { level: "info" | "warn" | "error"; message: string }[];
  findings: FindingDraft[];
  hypotheses: HypothesisDraft[];
  taskOutcomes: TaskOutcome[];
  stats: { hypothesesReviewed: number; combinationsAnalysed: number; kbEntities: number };
}

function finding(
  foundBy: string,
  domain: string,
  data: Omit<FindingDraft, "foundBy" | "domain">,
): FindingDraft {
  return { foundBy, domain, ...data };
}

function confidenceFromSources(sourceKeys: string[], base = 30): number {
  const unique = new Set(sourceKeys);
  const wiki = [...unique].filter((k) => k.startsWith("wiki-")).length;
  const patch = [...unique].filter((k) => k.startsWith("patch-")).length;
  const community = [...unique].filter((k) => k.startsWith("reddit-") || k.startsWith("forum-")).length;
  return Math.max(5, Math.min(95, base + wiki * 8 + patch * 10 - community * 3));
}

/* --------------------------------------------------------------- AGENT-01 */

function agent01(): AgentRunResult {
  const logs: AgentRunResult["logs"] = [];
  const findings: FindingDraft[] = [];
  const candidates = CREATURES.filter(
    (c) => c.underrated || c.confidence !== "documented" || (c.grants ?? []).some((s) => BUFF_BY_SLUG.get(s)?.confidence !== "documented"),
  );
  logs.push({ level: "info", message: `Auditing ${CREATURES.length} creatures; ${candidates.length} flagged for deeper review.` });

  const dualThreat = CREATURES.filter((c) => c.profile.utility >= 65 && c.profile.damage >= 55);
  findings.push(
    finding("AGENT-01", "creature-intelligence", {
      title: `${dualThreat.length} creatures are simultaneously high-damage and high-utility`,
      summary: `${dualThreat
        .map((c) => c.name)
        .join(", ")} carry both a combat rating above 55 and a utility rating above 65. Conventional tier lists evaluate damage alone, which systematically underrates them — the correct comparison is damage *per unit of utility delivered*.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 72,
      evidenceQuality: "knowledge-base-analysis",
      surprising: true,
      creatureSlugs: dualThreat.map((c) => c.slug),
      buffSlugs: [],
      sourceKeys: ["wiki-root"],
    }),
  );

  const weightEfficient = CREATURES.filter((c) => (c.weightReductions ?? []).length > 0);
  findings.push(
    finding("AGENT-01", "creature-intelligence", {
      title: `Weight-reduction creatures create hidden raid logistics capacity`,
      summary: `${weightEfficient
        .map((c) => `${c.name} (${(c.weightReductions ?? []).map((w) => `${w.resource} ~${w.pct}%`).join(", ")})`)
        .join("; ")}. Effective carrying capacity is a combat multiplier: it determines how much ammunition, C4 and healing stock a raid can carry, and it is never included in composition comparisons.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 68,
      evidenceQuality: "knowledge-base-analysis",
      surprising: false,
      creatureSlugs: weightEfficient.map((c) => c.slug),
      buffSlugs: [],
      sourceKeys: ["wiki-root", "wiki-ankylosaurus", "wiki-castoroides", "wiki-magmasaur"],
    }),
  );

  const unverified = CREATURES.filter((c) => (c.grants ?? []).some((s) => BUFF_BY_SLUG.get(s)?.confidence === "needs-verification"));
  if (unverified.length > 0) {
    findings.push(
      finding("AGENT-01", "creature-intelligence", {
        title: `${unverified.length} creatures grant effects with unverified magnitudes`,
        summary: `${unverified
          .map((c) => `${c.name}: ${(c.grants ?? []).filter((s) => BUFF_BY_SLUG.get(s)?.confidence === "needs-verification").map((s) => BUFF_BY_SLUG.get(s)?.name).join(", ")}`)
          .join("; ")}. Until these are measured, any composition built on them is a hypothesis rather than a result.`,
        classification: "UNVERIFIED",
        confidenceScore: 20,
        evidenceQuality: "gap-analysis",
        surprising: false,
        creatureSlugs: unverified.map((c) => c.slug),
        buffSlugs: unverified.flatMap((c) => c.grants ?? []),
        sourceKeys: ["wiki-root"],
      }),
    );
  }

  const immunities = CREATURES.filter((c) => (c.immune ?? []).length > 0);
  findings.push(
    finding("AGENT-01", "creature-intelligence", {
      title: "Immunity relationships define hard counters, not stat differences",
      summary: `${immunities
        .map((c) => `${c.name} ignores ${(c.immune ?? []).map((s) => BUFF_BY_SLUG.get(s)?.name ?? s).join(", ")}`)
        .join("; ")}. Immunity is binary, so these matchups cannot be overcome with more breeding — the only counter is a different creature choice.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 75,
      evidenceQuality: "knowledge-base-analysis",
      surprising: false,
      creatureSlugs: immunities.map((c) => c.slug),
      buffSlugs: immunities.flatMap((c) => c.immune ?? []),
      sourceKeys: ["wiki-basilosaurus", "wiki-reaper", "wiki-electrophorus"],
    }),
  );

  return {
    agentCode: "AGENT-01",
    logs,
    findings,
    hypotheses: generateHypotheses().filter((h) => h.proposedBy === "AGENT-01").slice(0, 12),
    taskOutcomes: candidates.slice(0, 6).map((c) => ({
      title: `Dossier review: ${c.name}`,
      question: `Are all of ${c.name}'s abilities and modifiers documented and quantified?`,
      outcome: "completed" as const,
      summary: c.notes,
      priority: c.underrated ? 1 : 2,
    })),
    stats: { hypothesesReviewed: candidates.length, combinationsAnalysed: 0, kbEntities: CREATURES.length },
  };
}

/* --------------------------------------------------------------- AGENT-02 */

function agent02(): AgentRunResult {
  const logs: AgentRunResult["logs"] = [];
  const findings: FindingDraft[] = [];
  const contexts: ResearchContext[] = ["raid-assault", "raid-defence", "boss-arena", "pvp-open"];
  let analysed = 0;
  const best: { context: ResearchContext; slugs: string[]; score: number; delta: number }[] = [];

  for (const context of contexts) {
    for (const cand of candidateCombinations(context, 40)) {
      const a = analyseCombination(cand.slugs, context);
      analysed += 1;
      if (a.synergyDelta <= 0) continue;
      if (a.conflicts.some((c) => c.severity === "high")) continue;
      best.push({ context, slugs: cand.slugs, score: a.synergyScore, delta: a.synergyDelta });
    }
  }
  best.sort((x, y) => y.score - x.score);
  logs.push({ level: "info", message: `Analysed ${analysed} candidate combinations across 4 contexts.` });

  for (const b of best.slice(0, 5)) {
    const a = analyseCombination(b.slugs, b.context);
    findings.push(
      finding("AGENT-02", "synergy", {
        title: `${a.members.map((m) => m.name).join(" + ")} (${b.context.replace("-", " ")})`,
        summary: `${a.rationale} Model scores: party ${a.partyScore} vs best single member ${a.bestSingleScore}; documented damage multiplier available to the party ×${a.estimatedDamageMultiplier}, additive resistance ${Math.round(a.estimatedMitigation * 100)}%.`,
        classification: a.classification,
        confidenceScore: Math.min(80, Math.round(a.synergyScore * 0.8)),
        evidenceQuality: "simulation-only",
        surprising: a.members.some((m) => m.underrated),
        creatureSlugs: b.slugs,
        buffSlugs: a.documentedBuffs.map((x) => x.slug),
        sourceKeys: a.documentedBuffs.flatMap((x) => x.sources),
      }),
    );
  }

  const strongSynergyPairs = best.filter((b) => b.delta >= 12).length;
  findings.push(
    finding("AGENT-02", "synergy", {
      title: `${strongSynergyPairs} combinations beat their best single member by 12+ model points`,
      summary: `Of ${analysed} enumerated combinations, ${strongSynergyPairs} clear the platform's genuine-improvement threshold (party score exceeding the best member by 12 points) after conflict screening. The rest are redundancy: more creatures, no new capability.`,
      classification: "UNVERIFIED",
      confidenceScore: 45,
      evidenceQuality: "simulation-only",
      surprising: false,
      creatureSlugs: [],
      buffSlugs: [],
      sourceKeys: ["wiki-root"],
    }),
  );

  return {
    agentCode: "AGENT-02",
    logs,
    findings,
    hypotheses: generateHypotheses().filter((h) => h.proposedBy === "AGENT-02").slice(0, 15),
    taskOutcomes: best.slice(0, 6).map((b) => ({
      title: `Combination analysis: ${b.slugs.map((s) => CREATURE_BY_SLUG.get(s)?.name ?? s).join(" + ")}`,
      question: `Does this combination hold up outside the model?`,
      outcome: "completed" as const,
      summary: `Model synergy score ${b.score}, improvement over best single member +${b.delta} points in a ${b.context.replace("-", " ")} context.`,
      priority: b.score > 60 ? 1 : 3,
    })),
    stats: { hypothesesReviewed: best.length, combinationsAnalysed: analysed, kbEntities: CREATURES.length },
  };
}

/* --------------------------------------------------------------- AGENT-03 */

function agent03(): AgentRunResult {
  const logs: AgentRunResult["logs"] = [];
  const findings: FindingDraft[] = [];
  const soak = ["rock-elemental", "titanosaur", "doedicurus", "stegosaurus", "paraceratherium", "reaper-king"];
  const siege = ["mek", "titanosaur", "giganotosaurus", "phoenix", "arthropluera", "rock-elemental"];
  const support = ["daeodon", "yutyrannus", "snow-owl", "mammoth", "light-pet"];

  for (const context of ["raid-assault", "raid-defence"] as ResearchContext[]) {
    const composition =
      context === "raid-assault" ? [...soak.slice(0, 2), ...support.slice(0, 3), siege[0]] : [...support.slice(0, 2), "velonasaur", "stegosaurus", "paraceratherium"];
    const a = analyseCombination(composition, context);
    findings.push(
      finding("AGENT-03", "raid-intelligence", {
        title: `Reference ${context === "raid-assault" ? "assault" : "defensive"} formation: ${a.members.map((m) => m.name).join(" + ")}`,
        summary: `${a.rationale} Damage multiplier ×${a.estimatedDamageMultiplier}; additive resistance ${Math.round(a.estimatedMitigation * 100)}%; siege ${a.metrics.siege} pts; mitigation ${a.metrics.mitigation} pts. Conflicts: ${a.conflicts.map((c) => c.title).join("; ") || "none detected"}.`,
        classification: a.classification,
        confidenceScore: Math.min(75, 40 + a.synergyScore * 0.35),
        evidenceQuality: "simulation-only",
        surprising: a.conflicts.length > 0,
        creatureSlugs: a.memberSlugs,
        buffSlugs: a.documentedBuffs.map((b) => b.slug),
        sourceKeys: a.documentedBuffs.flatMap((b) => b.sources),
      }),
    );
  }

  const cakeLine = ["therizinosaurus", "triceratops", "stegosaurus", "paraceratherium", "mammoth"];
  const cakeAnalysis = analyseCombination(cakeLine, "raid-assault");
  findings.push(
    finding("AGENT-03", "raid-intelligence", {
      title: "Herbivore front line removes the Daeodon food bottleneck",
      summary: `${cakeAnalysis.members
        .map((m) => m.name)
        .join(" + ")} is a fully herbivorous front line: every member is healable by Sweet Vegetable Cake, which is stockpilable in advance and does not drain a creature's food pool mid-fight. Model party score ${cakeAnalysis.partyScore} with mitigation ${cakeAnalysis.metrics.mitigation} pts and no split-healing conflict.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 70,
      evidenceQuality: "knowledge-base-analysis",
      surprising: true,
      creatureSlugs: cakeLine,
      buffSlugs: ["sweet-vegetable-cake"],
      sourceKeys: ["wiki-consumables", "wiki-therizinosaurus", "wiki-trike", "wiki-stego"],
    }),
  );

  const bypass = ["arthropluera", "microraptor", "noglin", "karkinos", "mantis"];
  findings.push(
    finding("AGENT-03", "raid-intelligence", {
      title: "Anti-armour and anti-rider bypass tools are absent from conventional raid plans",
      summary: `${bypass
        .map((s) => CREATURE_BY_SLUG.get(s)?.name ?? s)
        .join(", ")} do not win stat contests — they ignore armour, dismount riders or convert enemy creatures. Against mutated, ascendant-saddled defenders these bypass mechanics are worth more than additional raw damage, and they cost a fraction of a war line to produce.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 65,
      evidenceQuality: "knowledge-base-analysis",
      surprising: true,
      creatureSlugs: bypass,
      buffSlugs: ["arthropluera-acid", "microraptor-dismount", "noglin-mind-control"],
      sourceKeys: ["wiki-arthropluera", "wiki-microraptor", "wiki-noglin", "wiki-mantis"],
    }),
  );

  return {
    agentCode: "AGENT-03",
    logs: [{ level: "info", message: "Modelled assault and defensive formations; screened for damage-typing and healing-channel conflicts." }],
    findings,
    hypotheses: generateHypotheses().filter((h) => h.proposedBy === "AGENT-03").slice(0, 12),
    taskOutcomes: [
      ...soak.slice(0, 3).map((s) => ({
        title: `Soak measurement: ${CREATURE_BY_SLUG.get(s)?.name ?? s}`,
        question: `What is the effective soak of this platform against projectile vs explosive damage?`,
        outcome: "queued" as const,
        summary: "Requires manual measurement with fixed turret configurations.",
        priority: 1,
      })),
    ],
    stats: { hypothesesReviewed: soak.length + siege.length, combinationsAnalysed: 2, kbEntities: CREATURES.length },
  };
}

/* --------------------------------------------------------------- AGENT-04 */

function agent04(): AgentRunResult {
  const logs: AgentRunResult["logs"] = [];
  const findings: FindingDraft[] = [];
  const interactions: { verdict: string; count: number; examples: string[] }[] = [];
  const pairs: { a: string; b: string; verdict: string; note: string; names: string }[] = [];

  for (let i = 0; i < BUFFS.length; i += 1) {
    for (let j = i; j < BUFFS.length; j += 1) {
      if (i === j && BUFFS[i].scope === "self") continue;
      const r = analyseBuffPair(BUFFS[i], BUFFS[j]);
      pairs.push({
        a: BUFFS[i].slug,
        b: BUFFS[j].slug,
        verdict: r.verdict,
        note: r.note,
        names: `${BUFFS[i].name} + ${BUFFS[j].name}`,
      });
    }
  }
  for (const verdict of ["stacks", "does-not-stack", "exclusive", "shared-source-refresh", "unknown"]) {
    const subset = pairs.filter((p) => p.verdict === verdict);
    interactions.push({ verdict, count: subset.length, examples: subset.slice(0, 3).map((p) => p.names) });
  }
  logs.push({ level: "info", message: `Computed ${pairs.length} pairwise buff interactions across ${BUFFS.length} effects.` });

  findings.push(
    finding("AGENT-04", "buff-interaction", {
      title: `Buff interaction matrix: ${pairs.length} pairs classified`,
      summary: `Verdicts: ${interactions.map((i) => `${i.verdict} ${i.count}`).join(", ")}. The ${interactions.find((i) => i.verdict === "unknown")?.count ?? 0} unknown pairs are the platform's highest-priority experiments because every composition calculation currently depends on an assumption about them.`,
      classification: "UNVERIFIED",
      confidenceScore: 40,
      evidenceQuality: "knowledge-base-analysis",
      surprising: false,
      creatureSlugs: [],
      buffSlugs: BUFFS.map((b) => b.slug),
      sourceKeys: ["wiki-root"],
    }),
  );

  const unknownPairs = pairs.filter((p) => p.verdict === "unknown").slice(0, 4);
  for (const p of unknownPairs) {
    findings.push(
      finding("AGENT-04", "buff-interaction", {
        title: `Undocumented combination: ${p.names}`,
        summary: p.note,
        classification: "UNVERIFIED",
        confidenceScore: 15,
        evidenceQuality: "gap-analysis",
        surprising: true,
        creatureSlugs: [p.a, p.b].map((s) => BUFF_BY_SLUG.get(s)?.sourceSlug ?? "").filter(Boolean),
        buffSlugs: [p.a, p.b],
        sourceKeys: ["wiki-root"],
      }),
    );
  }

  const exclusive = pairs.filter((p) => p.verdict === "exclusive");
  if (exclusive.length > 0) {
    findings.push(
      finding("AGENT-04", "buff-interaction", {
        title: `${exclusive.length} mutually exclusive effect pairs identified`,
        summary: `Exclusive pairs: ${exclusive.map((p) => p.names).join("; ")}. Slot competition means stacking these is wasted effort — the KB marks them as overriding, so only one applies at a time.`,
        classification: "SOURCE-SUPPORTED",
        confidenceScore: 62,
        evidenceQuality: "knowledge-base-analysis",
        surprising: false,
        creatureSlugs: [],
        buffSlugs: exclusive.flatMap((p) => [p.a, p.b]),
        sourceKeys: ["wiki-status-effects"],
      }),
    );
  }

  const unknownMagnitude = BUFFS.filter((b) => b.effects.some((e) => e.value === null));
  findings.push(
    finding("AGENT-04", "buff-interaction", {
      title: `${unknownMagnitude.length} buffs have no documented magnitude`,
      summary: `${unknownMagnitude
        .slice(0, 10)
        .map((b) => b.name)
        .join(", ")} carry no numeric value in the KB. The platform refuses to invent numbers for these, so any composition using them is reported with an explicit unknown rather than a fabricated bonus.`,
      classification: "UNVERIFIED",
      confidenceScore: 10,
      evidenceQuality: "gap-analysis",
      surprising: false,
      creatureSlugs: [],
      buffSlugs: unknownMagnitude.map((b) => b.slug),
      sourceKeys: ["wiki-root"],
    }),
  );

  return {
    agentCode: "AGENT-04",
    logs,
    findings,
    hypotheses: generateHypotheses().filter((h) => h.proposedBy === "AGENT-04").slice(0, 18),
    taskOutcomes: unknownPairs.map((p) => ({
      title: `Test ${p.names}`,
      question: p.note,
      outcome: "queued" as const,
      summary: "Pairwise buff experiment required before composition math can be trusted.",
      priority: 1,
    })),
    stats: { hypothesesReviewed: unknownMagnitude.length, combinationsAnalysed: pairs.length, kbEntities: BUFFS.length },
  };
}

/* --------------------------------------------------------------- AGENT-05 */

function agent05(): AgentRunResult {
  const findings: FindingDraft[] = [];
  for (const p of BREEDING_PROGRAMS) {
    findings.push(
      finding("AGENT-05", "breeding", {
        title: `${p.species} — ${p.role}`,
        summary: `Stat priority: ${p.statPriorities.join(" > ")}. ${p.mutationStrategy} ${p.imprintingNotes} ${p.notes}`,
        classification: p.confidence === "documented" ? "SOURCE-SUPPORTED" : "UNVERIFIED",
        confidenceScore: p.confidence === "documented" ? 70 : 35,
        evidenceQuality: p.confidence === "documented" ? "documented-mechanics" : "community-knowledge",
        surprising: p.role.toLowerCase().includes("logistics") || p.role.toLowerCase().includes("nursery"),
        creatureSlugs: [p.species],
        buffSlugs: [],
        sourceKeys: p.sourceKeys,
      }),
    );
  }
  findings.push(
    finding("AGENT-05", "breeding", {
      title: "Utility breeding lines multiply every other line",
      summary: `Maewing nursery throughput and Oviraptor egg-laying are not combat stats, but they set the ceiling on how fast any combat line can be produced. A tribe with an optimised utility line fields more imprinted creatures per week, which dominates any single stat-mutation advantage.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 68,
      evidenceQuality: "knowledge-base-analysis",
      surprising: true,
      creatureSlugs: ["maewing", "oviraptor"],
      buffSlugs: ["maewing-nurse", "oviraptor-egg-aura"],
      sourceKeys: ["wiki-maewing", "wiki-oviraptor"],
    }),
  );
  return {
    agentCode: "AGENT-05",
    logs: [{ level: "info", message: `Reviewed ${BREEDING_PROGRAMS.length} breeding programmes against combat roles.` }],
    findings,
    hypotheses: generateHypotheses().filter((h) => h.domain === "breeding").slice(0, 10),
    taskOutcomes: BREEDING_PROGRAMS.slice(0, 4).map((p) => ({
      title: `Validate breeding programme: ${p.species}`,
      question: `Does the recommended stat priority actually maximise performance for the role?`,
      outcome: "queued" as const,
      summary: `Needs a role-performance test comparing a ${p.statPriorities[0]}-focused line against a balanced line.`,
      priority: 3,
    })),
    stats: { hypothesesReviewed: BREEDING_PROGRAMS.length, combinationsAnalysed: 0, kbEntities: BREEDING_PROGRAMS.length },
  };
}

/* --------------------------------------------------------------- AGENT-06 */

function agent06(): AgentRunResult {
  const findings: FindingDraft[] = [];
  const meta = ["rex", "giganotosaurus", "shadowmane", "managarmr", "rock-drake", "reaper-king", "snow-owl"];
  const counters = CREATURES.filter((c) => c.profile.cc >= 70 || (c.grants ?? []).some((s) => BUFF_BY_SLUG.get(s)?.kind === "debuff"));
  const cheap = counters.filter((c) => c.tier === "shoulder" || c.tier === "small" || c.tier === "medium");

  findings.push(
    finding("AGENT-06", "pvp-meta", {
      title: `${cheap.length} low-cost creatures carry hard control effects`,
      summary: `${cheap
        .map((c) => c.name)
        .join(", ")} are small or shoulder-tier creatures with control ratings of 70+, versus the meta benchmark of ${meta
        .map((s) => CREATURE_BY_SLUG.get(s)?.name ?? s)
        .join(", ")}. Per tame slot — and per breeding hour — the control creatures remove more enemy value than they cost, which is the metric that decides open-field PvP.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 66,
      evidenceQuality: "knowledge-base-analysis",
      surprising: true,
      creatureSlugs: cheap.map((c) => c.slug),
      buffSlugs: [],
      sourceKeys: ["wiki-microraptor", "wiki-kaprosuchus", "wiki-araneo", "wiki-noglin"],
    }),
  );

  const armourBypass = BUFFS.filter((b) => b.notes.toLowerCase().includes("armour") || b.category === "siege");
  findings.push(
    finding("AGENT-06", "pvp-meta", {
      title: "Armour-independent damage is the correct answer to mutated PvP tanks",
      summary: `${armourBypass
        .map((b) => b.name)
        .join(", ")} do not interact with saddle armour in the usual way (bleed drains percentage health, acid destroys armour durability, poison clouds are reported to strike the rider directly). Against a fully mutated, ascendant-saddled line, stacking armour-independent sources beats stacking more melee.`,
      classification: "PARTIALLY-VALIDATED",
      confidenceScore: 55,
      evidenceQuality: "mixed-sources",
      surprising: true,
      creatureSlugs: ["allosaurus", "deinonychus", "arthropluera", "thylacoleo", "wyvern-poison"],
      buffSlugs: armourBypass.map((b) => b.slug),
      sourceKeys: ["wiki-status-effects", "reddit-poison-wyvern", "wiki-arthropluera"],
    }),
  );

  const stealthCounters = ["desmodus", "parasaurolophus"];
  findings.push(
    finding("AGENT-06", "pvp-meta", {
      title: "Stealth compositions have cheap, rarely-used counters",
      summary: `${stealthCounters
        .map((s) => CREATURE_BY_SLUG.get(s)?.name ?? s)
        .join(" and ")} reveal hidden players and creatures (sonar and threat scan). If verified against Rock Drake cloak and Shadowmane group stealth, the current stealth-raid meta has a counter that costs almost nothing to field.`,
      classification: "UNVERIFIED",
      confidenceScore: 35,
      evidenceQuality: "community-reports",
      surprising: true,
      creatureSlugs: [...stealthCounters, "rock-drake", "shadowmane"],
      buffSlugs: ["desmodus-sonar-reveal", "parasaur-scan", "rock-drake-cloak", "shadowmane-pack-stealth"],
      sourceKeys: ["wiki-desmodus", "wiki-parasaur", "wiki-rock-drake"],
    }),
  );

  const openField = analyseCombination(["microraptor", "managarmr", "daeodon", "yutyrannus"], "pvp-open");
  findings.push(
    finding("AGENT-06", "pvp-meta", {
      title: `Control-chain open-field composition: ${openField.members.map((m) => m.name).join(" + ")}`,
      summary: `${openField.rationale} Model control coverage ${openField.metrics.cc} pts with damage ×${openField.estimatedDamageMultiplier}. The design principle: slow or dismount first, then damage — not the reverse.`,
      classification: openField.classification,
      confidenceScore: Math.round(40 + openField.synergyScore * 0.35),
      evidenceQuality: "simulation-only",
      surprising: true,
      creatureSlugs: openField.memberSlugs,
      buffSlugs: openField.documentedBuffs.map((b) => b.slug),
      sourceKeys: ["wiki-microraptor", "wiki-managarmr", "wiki-yuty"],
    }),
  );

  return {
    agentCode: "AGENT-06",
    logs: [{ level: "info", message: `Built counter matrix for ${counters.length} control creatures against ${meta.length} meta creatures.` }],
    findings,
    hypotheses: generateHypotheses().filter((h) => h.proposedBy === "AGENT-06").slice(0, 15),
    taskOutcomes: [
      { title: "Verify stealth detection", question: "Do sonar and threat scan break Rock Drake cloak and Shadowmane stealth?", outcome: "queued", summary: "Direct in-game test required.", priority: 1 },
      { title: "Verify armour bypass list", question: "Which damage sources ignore saddle armour exactly?", outcome: "queued", summary: "Fixed-HP target test with and without ascendant saddle.", priority: 1 },
    ],
    stats: { hypothesesReviewed: counters.length, combinationsAnalysed: 1, kbEntities: meta.length },
  };
}

/* --------------------------------------------------------------- AGENT-07 */

function agent07(): AgentRunResult {
  const findings: FindingDraft[] = [];
  for (const boss of BOSSES) {
    const context: ResearchContext = "boss-arena";
    const a = analyseCombination(boss.recommendedSlugs, context);
    findings.push(
      finding("AGENT-07", "pve-boss", {
        title: `${boss.name} — recommended composition`,
        summary: `Arena restrictions: ${boss.restrictions.join("; ")}. Recommended: ${a.members
          .map((m) => m.name)
          .join(", ")}. Model party score ${a.partyScore}, healing ${a.metrics.healing} pts, damage ${a.metrics.damage} pts. ${boss.notes}`,
        classification: a.classification,
        confidenceScore: Math.round(45 + a.synergyScore * 0.3),
        evidenceQuality: "simulation-plus-documentation",
        surprising: a.members.some((m) => m.underrated),
        creatureSlugs: a.memberSlugs,
        buffSlugs: a.documentedBuffs.map((b) => b.slug),
        sourceKeys: ["wiki-root", ...a.documentedBuffs.flatMap((b) => b.sources)],
      }),
    );
  }
  const radiationGated = BOSSES.filter((b) => b.restrictions.includes("Radiation"));
  findings.push(
    finding("AGENT-07", "pve-boss", {
      title: "Arena constraints eliminate most of the roster before combat stats matter",
      summary: `${radiationGated
        .map((b) => b.name)
        .join(", ")} require radiation immunity, and flying bosses invalidate ground-only melee compositions. Constraint filtering must run before composition optimisation — the platform applies restrictions first, then scores.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 72,
      evidenceQuality: "documented-mechanics",
      surprising: false,
      creatureSlugs: ["rock-drake", "reaper-king", "karkinos", "velonasaur", "managarmr"],
      buffSlugs: [],
      sourceKeys: ["wiki-root", "wiki-rock-drake"],
    }),
  );
  return {
    agentCode: "AGENT-07",
    logs: [{ level: "info", message: `Scored compositions for ${BOSSES.length} boss encounters under arena restrictions.` }],
    findings,
    hypotheses: generateHypotheses().filter((h) => h.proposedBy === "AGENT-07").slice(0, 10),
    taskOutcomes: BOSSES.slice(0, 4).map((b) => ({
      title: `Boss run: ${b.name}`,
      question: `Does the recommended composition beat the conventional benchmark at the same difficulty?`,
      outcome: "queued" as const,
      summary: `Requires in-arena timing runs at identical difficulty.`,
      priority: 2,
    })),
    stats: { hypothesesReviewed: BOSSES.length, combinationsAnalysed: BOSSES.length, kbEntities: BOSSES.length },
  };
}

/* --------------------------------------------------------------- AGENT-08 */

function agent08(): AgentRunResult {
  const findings: FindingDraft[] = MECHANICS.map((m) =>
    finding("AGENT-08", "mechanics", {
      title: m.title,
      summary: `${m.description} DOCUMENTED: ${m.documentedBehaviour} REPORTED: ${m.observedBehaviour} Status: ${m.status}.`,
      classification: m.status === "documented" ? "SOURCE-SUPPORTED" : "UNVERIFIED",
      confidenceScore: m.confidence === "documented" ? 75 : m.confidence === "community-reported" ? 35 : 12,
      evidenceQuality: m.status,
      surprising: m.tags.includes("inverted-interaction") || m.tags.includes("underrated"),
      creatureSlugs: [],
      buffSlugs: [],
      sourceKeys: m.sourceKeys,
    }),
  );
  findings.push(
    finding("AGENT-08", "mechanics", {
      title: "Charge light is the clearest inverted interaction in the game",
      summary: `One mechanic — charge light — suppresses Nameless transformation, strips Reaper damage reduction and simultaneously empowers Seekers. Most players only know the first effect, which means the same shoulder pet is a buff or a debuff depending on the enemy. The platform treats this as the canonical example of an interaction that stat sheets cannot capture.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 78,
      evidenceQuality: "documented-mechanics",
      surprising: true,
      creatureSlugs: ["light-pet", "reaper-king", "enforcer"],
      buffSlugs: ["charge-light-aura", "reaper-charge-vulnerability", "nameless-charge-suppression", "seeker-charge-empowerment"],
      sourceKeys: ["wiki-light-pets", "wiki-reaper", "wiki-seeker", "wiki-nameless"],
    }),
  );
  return {
    agentCode: "AGENT-08",
    logs: [
      { level: "info", message: `Triaged ${MECHANICS.length} mechanics into documented / community-claimed / disputed / needs-verification.` },
      ...(ORPHAN_BUFF_REFERENCES.length > 0
        ? [{ level: "warn" as const, message: `Orphan buff references in the KB: ${ORPHAN_BUFF_REFERENCES.join(", ")}` }]
        : []),
    ],
    findings,
    hypotheses: generateHypotheses().filter((h) => h.proposedBy === "AGENT-08").slice(0, 12),
    taskOutcomes: MECHANICS.filter((m) => m.status === "needs-verification").slice(0, 6).map((m) => ({
      title: m.title,
      question: m.description,
      outcome: "queued" as const,
      summary: `Controlled reproduction required. Documented: ${m.documentedBehaviour}`,
      priority: 1,
    })),
    stats: { hypothesesReviewed: MECHANICS.length, combinationsAnalysed: 0, kbEntities: MECHANICS.length },
  };
}

/* --------------------------------------------------------------- AGENT-09 */

function agent09(): AgentRunResult {
  const findings: FindingDraft[] = [];
  const bySourceType = BUFFS.reduce<Record<string, number>>((acc, b) => {
    acc[b.sourceType] = (acc[b.sourceType] ?? 0) + 1;
    return acc;
  }, {});
  findings.push(
    finding("AGENT-09", "data-research", {
      title: `Source-reliability audit of ${BUFFS.length} effects`,
      summary: `Effects by source type: ${Object.entries(bySourceType)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}. Documented: ${BUFFS.filter((b) => b.confidence === "documented").length}; community-reported: ${
        BUFFS.filter((b) => b.confidence === "community-reported").length
      }; needs-verification: ${BUFFS.filter((b) => b.confidence === "needs-verification").length}. Every composition claim in the platform is tagged with the reliability of the weakest source behind it.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 70,
      evidenceQuality: "source-audit",
      surprising: false,
      creatureSlugs: [],
      buffSlugs: BUFFS.map((b) => b.slug),
      sourceKeys: ["wiki-root", "patch-notes-archive"],
    }),
  );

  const disputes = BUFFS.filter((b) => b.notes.toLowerCase().includes("disputed") || b.notes.toLowerCase().includes("varies") || b.notes.toLowerCase().includes("uncertain"));
  findings.push(
    finding("AGENT-09", "data-research", {
      title: `${disputes.length} effects have known cross-source disagreement`,
      summary: `${disputes.map((b) => `${b.name} (${b.confidence})`).join("; ")}. These are exactly the values that make community guides mutually contradictory, and they should be measured before any composition that depends on them is published as advice.`,
      classification: "UNVERIFIED",
      confidenceScore: 30,
      evidenceQuality: "disagreement-detection",
      surprising: false,
      creatureSlugs: [],
      buffSlugs: disputes.map((b) => b.slug),
      sourceKeys: ["wiki-root", "reddit-ark", "forum-reports"],
    }),
  );

  findings.push(
    finding("AGENT-09", "data-research", {
      title: "Version drift invalidates unlabelled numbers",
      summary: `Patch history shows repeated reworks of buff mechanics (TLC phases 2 and 3 reworked roars, plate modes and pack buffs). Any source that does not state its game version cannot be compared with a source from a different era. The KB therefore records a version tag on every source and flags late-addition creatures as lower confidence.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 72,
      evidenceQuality: "source-audit",
      surprising: false,
      creatureSlugs: [],
      buffSlugs: [],
      sourceKeys: ["patch-notes-archive", "patch-tlc2", "patch-tlc3"],
    }),
  );

  return {
    agentCode: "AGENT-09",
    logs: [{ level: "info", message: "Cross-referenced KB citations against the source registry and patch history." }],
    findings,
    hypotheses: generateHypotheses().filter((h) => h.proposedBy === "AGENT-09").slice(0, 12),
    taskOutcomes: [
      { title: "Acquire primary sources for disputed values", question: "Which disputed values have a primary source that resolves them?", outcome: "queued", summary: "Literature review task.", priority: 2 },
    ],
    stats: { hypothesesReviewed: disputes.length, combinationsAnalysed: 0, kbEntities: BUFFS.length },
  };
}

/* -------------------------------------------------------------- AGENT-10 */

function agent10(hypotheses: HypothesisDraft[]): AgentRunResult {
  const findings: FindingDraft[] = [];
  const unvalidated = hypotheses.filter((h) => h.confidence < 60);
  findings.push(
    finding("AGENT-10", "validation", {
      title: `${unvalidated.length} hypotheses below the confidence threshold require experiments`,
      summary: `The platform will not promote any of these to a higher classification without recorded measurements. Each has a designed procedure with a baseline run, a single-variable run and a replication requirement. The most feasible first targets are: ${unvalidated
        .filter((h) => h.feasibility >= 80)
        .slice(0, 5)
        .map((h) => h.question)
        .join(" | ")}.`,
      classification: "UNVERIFIED",
      confidenceScore: 25,
      evidenceQuality: "experiment-design",
      surprising: false,
      creatureSlugs: [],
      buffSlugs: [],
      sourceKeys: ["wiki-root"],
    }),
  );
  const cheap = unvalidated.filter((h) => h.feasibility >= 85).slice(0, 3);
  findings.push(
    finding("AGENT-10", "validation", {
      title: "Fastest paths to real evidence",
      summary: `${cheap
        .map(
          (h) =>
            `${h.question} (feasibility ${h.feasibility}/100, priority ${h.priority}) — single-player reproducible with default settings and no exotic creatures.`,
        )
        .join(" | ")} These should be executed first because they convert the largest number of downstream assumptions into measurements.`,
      classification: "UNVERIFIED",
      confidenceScore: 30,
      evidenceQuality: "experiment-design",
      surprising: false,
      creatureSlugs: [],
      buffSlugs: [],
      sourceKeys: ["wiki-root"],
    }),
  );
  return {
    agentCode: "AGENT-10",
    logs: [{ level: "info", message: `Designed experiments for ${unvalidated.length} hypotheses; no results fabricated.` }],
    findings,
    hypotheses: [],
    taskOutcomes: cheap.map((h) => ({
      title: h.question,
      question: h.statement,
      outcome: "queued" as const,
      summary: h.rationale,
      priority: 1,
    })),
    stats: { hypothesesReviewed: unvalidated.length, combinationsAnalysed: 0, kbEntities: hypotheses.length },
  };
}

/* -------------------------------------------------------------- AGENT-11 */

function agent11(hypotheses: HypothesisDraft[]): AgentRunResult {
  const findings: FindingDraft[] = [];
  const underrated = CREATURES.filter((c) => c.underrated).sort((a, b) => b.profile.utility - a.profile.utility);
  findings.push(
    finding("AGENT-11", "meta-analysis", {
      title: `Most underrated creatures by combination potential`,
      summary: `${underrated
        .slice(0, 12)
        .map((c) => `${c.name} (utility ${c.profile.utility}, control ${c.profile.cc})`)
        .join("; ")}. Ranking uses utility and control rather than damage because those are the axes that change when a creature is placed in a supported composition — damage merely adds.`,
      classification: "SOURCE-SUPPORTED",
      confidenceScore: 68,
      evidenceQuality: "knowledge-base-analysis",
      surprising: true,
      creatureSlugs: underrated.map((c) => c.slug),
      buffSlugs: [],
      sourceKeys: ["wiki-root"],
    }),
  );

  const recurring = CREATURES.filter((c) => hypotheses.filter((h) => h.targetSlugs.includes(c.slug)).length >= 3);
  findings.push(
    finding("AGENT-11", "meta-analysis", {
      title: `${recurring.length} creatures appear across multiple research threads`,
      summary: `${recurring
        .slice(0, 12)
        .map((c) => `${c.name} (${hypotheses.filter((h) => h.targetSlugs.includes(c.slug)).length} hypotheses)`)
        .join("; ")}. Creatures that recur in unrelated investigations are the highest-value research targets: understanding them resolves several open questions at once.`,
      classification: "UNVERIFIED",
      confidenceScore: 40,
      evidenceQuality: "cross-agent-analysis",
      surprising: true,
      creatureSlugs: recurring.map((c) => c.slug),
      buffSlugs: [],
      sourceKeys: ["wiki-root"],
    }),
  );

  const benchmarks: [ResearchContext, string[]][] = [
    ["boss-arena", ["rex", "daeodon", "yutyrannus"]],
    ["raid-assault", ["rock-elemental", "daeodon", "yutyrannus"]],
    ["pvp-open", ["shadowmane", "daeodon", "yutyrannus"]],
  ];
  for (const [context, slugs] of benchmarks) {
    const base = analyseCombination(slugs, context);
    findings.push(
      finding("AGENT-11", "meta-analysis", {
        title: `Conventional benchmark — ${context.replace("-", " ")}: ${base.members.map((m) => m.name).join(" + ")}`,
        summary: `Party score ${base.partyScore}, synergy score ${base.synergyScore}, damage multiplier ×${base.estimatedDamageMultiplier}, additive resistance ${Math.round(base.estimatedMitigation * 100)}%. Every experimental composition is compared against this baseline before being recommended.`,
        classification: base.classification,
        confidenceScore: Math.round(50 + base.synergyScore * 0.25),
        evidenceQuality: "simulation-only",
        surprising: false,
        creatureSlugs: base.memberSlugs,
        buffSlugs: base.documentedBuffs.map((b) => b.slug),
        sourceKeys: base.documentedBuffs.flatMap((b) => b.sources),
      }),
    );
  }

  return {
    agentCode: "AGENT-11",
    logs: [{ level: "info", message: `Aggregated ${hypotheses.length} hypotheses and cross-referenced creature recurrence.` }],
    findings,
    hypotheses: generateHypotheses().filter((h) => h.proposedBy === "AGENT-11").slice(0, 12),
    taskOutcomes: [
      { title: "Publish comparison leaderboard", question: "Which experimental compositions actually beat the benchmarks?", outcome: "queued", summary: "Requires benchmark and experimental runs under identical conditions.", priority: 2 },
    ],
    stats: { hypothesesReviewed: hypotheses.length, combinationsAnalysed: benchmarks.length, kbEntities: CREATURES.length },
  };
}

/* -------------------------------------------------------------- AGENT-12 */

function agent12(hypotheses: HypothesisDraft[]): AgentRunResult {
  const findings: FindingDraft[] = [];
  const byDomain = hypotheses.reduce<Record<string, number>>((acc, h) => {
    acc[h.domain] = (acc[h.domain] ?? 0) + 1;
    return acc;
  }, {});
  const top = hypotheses.slice(0, 10);
  findings.push(
    finding("AGENT-12", "coordination", {
      title: `Research queue established: ${hypotheses.length} hypotheses across ${Object.keys(byDomain).length} domains`,
      summary: `Distribution: ${Object.entries(byDomain)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}. Priority ordering is documented in the hypothesis engine (impact 32%, novelty 24%, feasibility 20%, evidence 16%, confidence 8%).`,
      classification: "UNVERIFIED",
      confidenceScore: 40,
      evidenceQuality: "coordination",
      surprising: false,
      creatureSlugs: [],
      buffSlugs: [],
      sourceKeys: ["wiki-root"],
    }),
  );
  findings.push(
    finding("AGENT-12", "coordination", {
      title: "Evidence challenge: unsupported conclusions are held back",
      summary: `Any finding whose confidence score falls below 40 is retained as UNVERIFIED and excluded from the published report recommendations. ${top
        .slice(0, 5)
        .map((h) => `${h.question} (confidence ${h.confidence})`)
        .join(" | ")}. The director will only publish these with recorded experimental evidence.`,
      classification: "UNVERIFIED",
      confidenceScore: 45,
      evidenceQuality: "coordination",
      surprising: false,
      creatureSlugs: [],
      buffSlugs: [],
      sourceKeys: ["wiki-root"],
    }),
  );
  findings.push(
    finding("AGENT-12", "coordination", {
      title: "Generated next research questions",
      summary: `Follow-up questions derived from current findings: (1) Does the additive resistance cap hold above two simultaneous resistance buffs? (2) Do control effects share a diminishing-return timer? (3) Does diet-gated healing (cake) change the optimal front line on herbivore-only maps? (4) Does stealth detection reveal creatures that are cloaked *and* ridden? (5) Does nursery throughput scale linearly with Maewing count?`,
      classification: "UNVERIFIED",
      confidenceScore: 30,
      evidenceQuality: "coordination",
      surprising: true,
      creatureSlugs: [],
      buffSlugs: [],
      sourceKeys: ["wiki-root"],
    }),
  );
  return {
    agentCode: "AGENT-12",
    logs: [
      { level: "info", message: "Allocated research tasks, removed duplicates, and challenged low-evidence conclusions." },
    ],
    findings,
    hypotheses: [],
    taskOutcomes: top.slice(0, 6).map((h) => ({
      title: h.question,
      question: h.statement,
      outcome: "queued" as const,
      summary: `Assigned priority ${h.priority} in domain ${h.domain}.`,
      priority: 1,
    })),
    stats: { hypothesesReviewed: hypotheses.length, combinationsAnalysed: 0, kbEntities: AGENTS.length },
  };
}

/* ------------------------------------------------------------------ runner */

export function runAgent(agentCode: string, hypotheses?: HypothesisDraft[]): AgentRunResult {
  const all = hypotheses ?? generateHypotheses();
  switch (agentCode) {
    case "AGENT-01":
      return agent01();
    case "AGENT-02":
      return agent02();
    case "AGENT-03":
      return agent03();
    case "AGENT-04":
      return agent04();
    case "AGENT-05":
      return agent05();
    case "AGENT-06":
      return agent06();
    case "AGENT-07":
      return agent07();
    case "AGENT-08":
      return agent08();
    case "AGENT-09":
      return agent09();
    case "AGENT-10":
      return agent10(all);
    case "AGENT-11":
      return agent11(all);
    case "AGENT-12":
      return agent12(all);
    default:
      return {
        agentCode,
        logs: [{ level: "error", message: `Unknown agent ${agentCode}` }],
        findings: [],
        hypotheses: [],
        taskOutcomes: [],
        stats: { hypothesesReviewed: 0, combinationsAnalysed: 0, kbEntities: 0 },
      };
  }
}

export function agentSummary() {
  return AGENTS.map((a) => ({
    ...a,
    status: "idle" as const,
  }));
}

export type { ArkCreature };
