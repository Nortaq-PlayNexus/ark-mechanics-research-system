import { ALL_BUFF_RELATIONS, BUFFS, BUFF_BY_SLUG, CREATURE_BY_SLUG } from "@/lib/ark";
import type { ArkBuff, ArkCreature, CreatureProfile, DiscoveryClassification } from "@/lib/ark";

/**
 * COMBINATION DISCOVERY ENGINE
 *
 * Model (documented so every number can be challenged):
 * - Analyst profile ratings (0-100) per creature per axis, from the knowledge base.
 * - Additive axes (damage, healing, weight, siege) sum across the party with a
 *   crowding coefficient (BODY_BLOCK): N creatures cannot all strike the same
 *   target at once, so effective output grows sub-linearly.
 * - Mitigation models a front-line: the best soaker absorbs most incoming damage
 *   while the rest take splash (0.6 * best + 0.4 * mean).
 * - Coverage axes (cc, utility, mobility) reward having *someone* able to do it,
 *   not having many: max + diminishing returns on extras.
 * - Buff math only uses numeric values that are actually documented in the KB.
 *   Unknown magnitudes are excluded and reported as assumptions.
 */

export type ResearchContext =
  | "raid-assault"
  | "raid-defence"
  | "boss-arena"
  | "pvp-open"
  | "pve-general"
  | "logistics";

export const CONTEXT_WEIGHTS: Record<ResearchContext, Record<keyof CreatureProfile, number>> = {
  "raid-assault": { damage: 1.1, mitigation: 1.2, healing: 1.0, cc: 0.9, mobility: 0.7, weight: 0.5, utility: 0.7, siege: 1.6 },
  "raid-defence": { damage: 0.9, mitigation: 1.5, healing: 1.2, cc: 1.1, mobility: 0.5, weight: 0.4, utility: 1.1, siege: 0.6 },
  "boss-arena": { damage: 1.6, mitigation: 1.3, healing: 1.5, cc: 0.4, mobility: 0.4, weight: 0.2, utility: 0.7, siege: 0.1 },
  "pvp-open": { damage: 1.2, mitigation: 0.9, healing: 1.1, cc: 1.5, mobility: 1.4, weight: 0.3, utility: 0.9, siege: 0.3 },
  "pve-general": { damage: 1.0, mitigation: 0.9, healing: 0.8, cc: 0.6, mobility: 0.8, weight: 0.9, utility: 1.2, siege: 0.2 },
  logistics: { damage: 0.2, mitigation: 0.5, healing: 0.3, cc: 0.3, mobility: 1.2, weight: 1.8, utility: 1.6, siege: 0.2 },
};

const BODY_BLOCK = 0.06; // per extra body beyond the first, damage/healing crowding loss
const FRONTLINE_TANK_SHARE = 0.6;
const COVERAGE_DECAY = 0.45;
const SUPPORT_ROLES = [
  "damage-buff",
  "resistance-buff",
  "healing",
  "control",
  "detection-utility",
  "logistics-weight",
] as const;

export interface BuffInteraction {
  a: string;
  b: string;
  verdict: "stacks" | "does-not-stack" | "exclusive" | "unknown" | "shared-source-refresh";
  note: string;
  confidence: "documented" | "community-reported" | "needs-verification";
}

export interface CombinationConflict {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  sourceKeys: string[];
}

export interface CombinationMetric {
  damage: number;
  mitigation: number;
  healing: number;
  cc: number;
  mobility: number;
  weight: number;
  utility: number;
  siege: number;
  buffCoverage: number;
}

export interface CombinationAnalysis {
  memberSlugs: string[];
  members: ArkCreature[];
  context: ResearchContext;
  metrics: CombinationMetric;
  /** party-level score 0-100 for this context */
  partyScore: number;
  /** best single member score in the same context */
  bestSingleScore: number;
  /** average of member scores in the same context */
  meanMemberScore: number;
  /** partyScore - bestSingleScore (points) */
  synergyDelta: number;
  /** 0-100 synergy quality score that only rewards genuine improvement */
  synergyScore: number;
  buffInteractions: BuffInteraction[];
  conflicts: CombinationConflict[];
  documentedBuffs: ArkBuff[];
  unresolvedBuffs: ArkBuff[];
  estimatedDamageMultiplier: number;
  estimatedMitigation: number;
  supportCoverage: { role: (typeof SUPPORT_ROLES)[number]; covered: boolean; by: string[] }[];
  assumptions: string[];
  limitations: string[];
  rationale: string;
  classification: DiscoveryClassification;
  cost: { tameSlots: number; breedingLoad: number; resourceLoad: number };
  hash: string;
}

export function combinationHash(slugs: string[], context: string): string {
  return `${[...slugs].sort().join("+")}@${context}`;
}

function profileScore(c: ArkCreature, context: ResearchContext): number {
  const w = CONTEXT_WEIGHTS[context];
  const p = c.profile;
  const weighted =
    (p.damage * w.damage +
      p.mitigation * w.mitigation +
      p.healing * w.healing +
      p.cc * w.cc +
      p.mobility * w.mobility +
      p.weight * w.weight +
      p.utility * w.utility +
      p.siege * w.siege) /
    (w.damage + w.mitigation + w.healing + w.cc + w.mobility + w.weight + w.utility + w.siege);
  return round1(weighted);
}

function additive(values: number[]): number {
  if (values.length === 0) return 0;
  // sorted so the strongest contributor always receives full weight: the result
  // must not depend on the order in which members were selected.
  const ranked = [...values].sort((a, b) => b - a);
  let total = ranked[0];
  for (let i = 1; i < ranked.length; i += 1) total += ranked[i] * (1 - BODY_BLOCK * i);
  return round1(Math.max(0, total));
}

function frontline(values: number[]): number {
  if (values.length === 0) return 0;
  const best = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return round1(FRONTLINE_TANK_SHARE * best + (1 - FRONTLINE_TANK_SHARE) * mean);
}

function coverage(values: number[]): number {
  const sorted = [...values].sort((a, b) => b - a);
  let total = 0;
  sorted.forEach((v, i) => {
    total += v * Math.pow(1 - COVERAGE_DECAY, i);
  });
  return round1(total);
}

function buffsProvidedBy(members: ArkCreature[]): ArkBuff[] {
  const out: ArkBuff[] = [];
  const seen = new Set<string>();
  for (const m of members) {
    for (const slug of m.grants ?? []) {
      const b = BUFF_BY_SLUG.get(slug);
      if (!b || seen.has(b.slug)) continue;
      seen.add(b.slug);
      out.push(b);
    }
  }
  // buffs granted by equipment/food the party is assumed to carry
  for (const slug of ["sweet-vegetable-cake", "medical-brew", "shadow-steak-saute"]) {
    const b = BUFF_BY_SLUG.get(slug);
    if (b && !seen.has(b.slug) && members.some((m) => (m.diet ?? "").includes("herbivore") || slug !== "sweet-vegetable-cake")) {
      seen.add(b.slug);
      out.push(b);
    }
  }
  return out;
}

export function analyseBuffPair(a: ArkBuff, b: ArkBuff): BuffInteraction {
  if (a.slug === b.slug) {
    return {
      a: a.slug,
      b: b.slug,
      verdict: a.stacking === "stacks" ? "stacks" : "shared-source-refresh",
      note:
        a.stacking === "stacks"
          ? "This effect stacks with itself per the KB."
          : `Same-effect repetition: ${a.stacking}. Adding a second source does not add a second instance.`,
      confidence: a.confidence,
    };
  }
  if (a.exclusiveWith?.includes(b.slug) || b.exclusiveWith?.includes(a.slug)) {
    return {
      a: a.slug,
      b: b.slug,
      verdict: "exclusive",
      note: "The knowledge base marks these as mutually exclusive / overriding — only one applies.",
      confidence: "documented",
    };
  }
  const sameCategory = a.category === b.category;
  const bothKnown = a.stacking !== "unknown" && b.stacking !== "unknown";
  if (sameCategory && bothKnown && a.stacking === "does-not-stack" && b.stacking === "does-not-stack") {
    return {
      a: a.slug,
      b: b.slug,
      verdict: "does-not-stack",
      note:
        "Both effects occupy the same modifier slot in the KB model. Treat as parallel bonuses of different types, not as compounding — combination rule still needs experimental confirmation.",
      confidence: "community-reported",
    };
  }
  if (sameCategory) {
    return {
      a: a.slug,
      b: b.slug,
      verdict: "unknown",
      note: `Same category (${a.category}) with incomplete stacking data: the combination rule is undocumented and is a priority experiment.`,
      confidence: "needs-verification",
    };
  }
  return {
    a: a.slug,
    b: b.slug,
    verdict: "stacks",
    note: `Different modifier categories (${a.category} + ${b.category}); no documented conflict in the KB. Expect compounding, subject to confirmation.`,
    confidence: "community-reported",
  };
}

function detectConflicts(members: ArkCreature[], buffs: ArkBuff[]): CombinationConflict[] {
  const conflicts: CombinationConflict[] = [];
  const slugs = new Set(members.map((m) => m.slug));

  if (slugs.has("yutyrannus")) {
    const smallAllies = members.filter((m) => m.tier === "shoulder" || m.tier === "small");
    if (smallAllies.length > 0) {
      conflicts.push({
        severity: "high",
        title: "Fear Roar friendly-fire risk",
        detail: `Yutyrannus Fear Roar routs creatures below a level threshold and is not reliably ally-selective. In this party it can scatter your own ${smallAllies
          .map((m) => m.name)
          .join(", ")}.`,
        sourceKeys: ["wiki-yuty", "forum-reports"],
      });
    }
  }

  if (slugs.has("light-pet") && slugs.has("reaper-king")) {
    conflicts.push({
      severity: "high",
      title: "Charge light strips your own Reaper's damage reduction",
      detail:
        "Light pets radiate charge light, and charge light removes a large part of a Reaper's damage reduction. Bringing both in one party weakens your own front line — the interaction players usually only exploit against enemy Reapers.",
      sourceKeys: ["wiki-light-pets", "wiki-reaper"],
    });
  }

  if (slugs.has("giganotosaurus")) {
    conflicts.push({
      severity: "medium",
      title: "Giga rage friendly-fire",
      detail:
        "An enraged Giganotosaurus throws its rider and attacks nearby creatures including allies. Keep the healer and buffer outside melee range or accept the risk.",
      sourceKeys: ["wiki-giga"],
    });
  }

  if (slugs.has("snow-owl") && members.some((m) => m.profile.mobility >= 80)) {
    conflicts.push({
      severity: "low",
      title: "Freeze heal immobilises fast allies",
      detail:
        "Snow Owl healing encases allies in ice, which stops highly mobile members from repositioning during the heal window.",
      sourceKeys: ["wiki-snow-owl"],
    });
  }

  for (const buff of buffs) {
    if (buff.kind !== "debuff" || buff.scope !== "area") continue;
    const victims = members.filter((m) => (m.immune ?? []).includes(buff.slug));
    if (victims.length > 0) {
      conflicts.push({
        severity: "low",
        title: `Area debuff wasted on immune member`,
        detail: `${buff.name} has no effect on ${victims.map((v) => v.name).join(", ")} — plan the debuff around them rather than assuming it covers the party.`,
        sourceKeys: buff.sources,
      });
    }
  }

  // herbivore cake heal only applies to herbivores
  const herbivores = members.filter((m) => m.diet.includes("herbivore"));
  const carnivores = members.filter((m) => !m.diet.includes("herbivore"));
  if (herbivores.length > 0 && carnivores.length > 0) {
    conflicts.push({
      severity: "medium",
      title: "Split healing logistics",
      detail:
        "Sweet Vegetable Cake heals herbivores only, so this party needs a second sustain channel (Daeodon aura, Snow Owl) for its carnivore members. Either split the front line by diet or double up on healing.",
      sourceKeys: ["wiki-consumables"],
    });
  }

  const duplicates = members.filter((m, i) => members.findIndex((x) => x.slug === m.slug) !== i);
  if (duplicates.length > 0) {
    conflicts.push({
      severity: "low",
      title: "Duplicate creature redundancy",
      detail:
        "Repeating a creature adds raw output but no new capability. In this model duplicates are the main way a combination looks impressive without being genuinely better.",
      sourceKeys: [],
    });
  }

  return conflicts;
}

function supportCoverageOf(members: ArkCreature[], buffs: ArkBuff[]) {
  const providers = (predicate: (b: ArkBuff) => boolean) =>
    buffs.filter(predicate).map((b) => b.sourceSlug ?? b.slug);
  return SUPPORT_ROLES.map((role) => {
    let by: string[] = [];
    if (role === "damage-buff") by = providers((b) => b.category === "damage" && b.kind !== "debuff" && b.scope !== "enemies");
    if (role === "resistance-buff") by = providers((b) => b.category === "resistance" || (b.category === "survival" && b.scope !== "self"));
    if (role === "healing") by = providers((b) => b.category === "healing");
    if (role === "control") {
      by = members.filter((m) => m.profile.cc >= 60).map((m) => m.name);
      by = [...by, ...providers((b) => b.category === "control" && b.kind === "debuff")];
    }
    if (role === "detection-utility") {
      by = members.filter((m) => m.profile.utility >= 75 || m.roles.includes("recon")).map((m) => m.name);
      by = [...by, ...providers((b) => b.category === "utility" && b.scope === "area")];
    }
    if (role === "logistics-weight") by = members.filter((m) => m.profile.weight >= 60 || m.roles.includes("logistics")).map((m) => m.name);
    return { role, covered: by.length > 0, by: [...new Set(by)].slice(0, 4) };
  });
}

function documentedDamageMultiplier(buffs: ArkBuff[]): { multiplier: number; used: string[] } {
  let multiplier = 1;
  const used: string[] = [];
  for (const b of buffs) {
    if (b.kind === "debuff" && b.scope === "enemies") continue;
    for (const e of b.effects) {
      if (e.stat !== "meleeDamage") continue;
      if (e.mode === "multiplicative" && typeof e.value === "number") {
        multiplier *= e.value;
        used.push(`${b.name}: x${e.value}`);
      }
    }
  }
  return { multiplier: round2(multiplier), used };
}

function documentedMitigation(buffs: ArkBuff[]): { reduction: number; used: string[]; unknowns: string[] } {
  let additive = 0;
  const used: string[] = [];
  const unknowns: string[] = [];
  for (const b of buffs) {
    for (const e of b.effects) {
      if (e.stat !== "damageReduction") continue;
      if (e.mode === "additive" && typeof e.value === "number") {
        additive += e.value;
        used.push(`${b.name}: +${Math.round(e.value * 100)}%`);
      } else {
        unknowns.push(`${b.name} (${e.mode})`);
      }
    }
  }
  // additive resistances are capped in the model — documented as an assumption
  const capped = Math.min(0.85, additive);
  return { reduction: round2(capped), used, unknowns };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function analyseCombination(slugs: string[], context: ResearchContext): CombinationAnalysis {
  const members = slugs
    .map((s) => CREATURE_BY_SLUG.get(s))
    .filter((c): c is ArkCreature => Boolean(c));
  const unique = members.filter((m, i) => members.findIndex((x) => x.slug === m.slug) === i);
  const buffs = buffsProvidedBy(unique);
  const interactions: BuffInteraction[] = [];
  for (let i = 0; i < buffs.length; i += 1) {
    for (let j = i; j < buffs.length; j += 1) {
      if (i === j && buffs[i].scope === "self") continue;
      interactions.push(analyseBuffPair(buffs[i], buffs[j]));
    }
  }
  const conflicts = detectConflicts(unique, buffs);
  const cov = supportCoverageOf(unique, buffs);
  const coverageRatio = cov.filter((c) => c.covered).length / cov.length;

  const metrics: CombinationMetric = {
    damage: additive(unique.map((m) => m.profile.damage)),
    mitigation: frontline(unique.map((m) => m.profile.mitigation)),
    healing: additive(unique.map((m) => m.profile.healing)),
    cc: coverage(unique.map((m) => m.profile.cc)),
    mobility: coverage(unique.map((m) => m.profile.mobility)),
    weight: additive(unique.map((m) => m.profile.weight)),
    utility: coverage(unique.map((m) => m.profile.utility)),
    siege: additive(unique.map((m) => m.profile.siege)),
    buffCoverage: round1(coverageRatio * 100),
  };

  const w = CONTEXT_WEIGHTS[context];
  const partyScore = round1(
    (metrics.damage * w.damage +
      metrics.mitigation * w.mitigation +
      metrics.healing * w.healing +
      metrics.cc * w.cc +
      metrics.mobility * w.mobility +
      metrics.weight * w.weight +
      metrics.utility * w.utility +
      metrics.siege * w.siege +
      metrics.buffCoverage * 1.2) /
      (w.damage + w.mitigation + w.healing + w.cc + w.mobility + w.weight + w.utility + w.siege + 1.2),
  );

  const memberScores = unique.map((m) => profileScore(m, context));
  const bestSingleScore = memberScores.length ? Math.max(...memberScores) : 0;
  const meanMemberScore = memberScores.length ? round1(memberScores.reduce((a, b) => a + b, 0) / memberScores.length) : 0;
  const synergyDelta = round1(partyScore - bestSingleScore);

  const highConflicts = conflicts.filter((c) => c.severity === "high").length;
  const unknownPairs = interactions.filter((i) => i.verdict === "unknown").length;
  const stackingPairs = interactions.filter((i) => i.verdict === "stacks").length;

  // Synergy score rewards (a) beating the best single creature by a real margin,
  // (b) coverage of support roles, (c) documented compounding, and penalises
  // redundancy, unknown rules and conflicts.
  const coverageBonus = coverageRatio * 30;
  const improvement = Math.max(0, Math.min(30, (synergyDelta / 25) * 30));
  const compounding = Math.min(18, stackingPairs * 4);
  const conflictPenalty = highConflicts * 9 + (conflicts.length - highConflicts) * 2;
  const unknownPenalty = Math.min(12, unknownPairs * 3);
  const redundancyPenalty = unique.length !== new Set(unique.map((m) => m.roles[0])).size ? 4 : 0;
  const synergyScore = Math.max(
    0,
    Math.min(100, round1(20 + coverageBonus * 0.5 + improvement + compounding - conflictPenalty - unknownPenalty - redundancyPenalty)),
  );

  const dmg = documentedDamageMultiplier(buffs);
  const mit = documentedMitigation(buffs);
  const unresolvedBuffs = buffs.filter((b) => b.confidence !== "documented" || b.stacking === "unknown");
  const documentedBuffs = buffs.filter((b) => b.confidence === "documented");

  const assumptions = [
    `Profile values are ARK OMNISCIENCE analyst ratings (0-100), not in-game numbers.`,
    `Additive axes assume ${Math.round(BODY_BLOCK * 100)}% crowding loss per extra body beyond the first.`,
    `Mitigation models a front line as ${Math.round(FRONTLINE_TANK_SHARE * 100)}% best soaker + ${Math.round((1 - FRONTLINE_TANK_SHARE) * 100)}% party average.`,
    `Coverage axes decay ${Math.round(COVERAGE_DECAY * 100)}% per additional contributor.`,
    mit.unknowns.length > 0
      ? `Resistance combination rule unknown for: ${mit.unknowns.join(", ")}. Model caps additive resistance at 85%.`
      : `No additive resistance cap was reached.`,
    dmg.used.length > 0 ? `Documented damage multipliers applied: ${dmg.used.join(", ")}.` : `No documented numeric damage buff applies to this party.`,
  ];

  const limitations = [
    ...unresolvedBuffs.map((b) => `${b.name}: ${b.confidence === "documented" ? "stacking rule undocumented" : `${b.confidence} data`}.`),
    `No in-game measurements exist for this combination yet — the analysis is simulation-only until an experiment is recorded.`,
    `Saddle quality, imprint bonus, rider gear, server multipliers and creature levels are not modelled and would change every number.`,
  ];

  const rationale = buildRationale(unique, cov, conflicts, synergyDelta, context);
  const classification: DiscoveryClassification =
    documentedBuffs.length > 0 && unknownPairs === 0
      ? "SOURCE-SUPPORTED"
      : unresolvedBuffs.length === 0
        ? "UNVERIFIED"
        : "UNVERIFIED";

  return {
    memberSlugs: unique.map((m) => m.slug),
    members: unique,
    context,
    metrics,
    partyScore,
    bestSingleScore,
    meanMemberScore,
    synergyDelta,
    synergyScore,
    buffInteractions: interactions,
    conflicts,
    documentedBuffs,
    unresolvedBuffs,
    estimatedDamageMultiplier: dmg.multiplier,
    estimatedMitigation: mit.reduction,
    supportCoverage: cov,
    assumptions,
    limitations,
    rationale,
    classification,
    cost: {
      tameSlots: unique.length,
      breedingLoad: unique.reduce((n, m) => n + (m.tier === "titan" ? 6 : m.tier === "large" ? 3 : m.tier === "medium" ? 2 : 1), 0),
      resourceLoad: unique.reduce((n, m) => n + (m.baseHp > 1000 ? 3 : m.baseHp > 500 ? 2 : 1), 0),
    },
    hash: combinationHash(unique.map((m) => m.slug), context),
  };
}

function buildRationale(
  members: ArkCreature[],
  cov: { role: string; covered: boolean; by: string[] }[],
  conflicts: CombinationConflict[],
  synergyDelta: number,
  context: ResearchContext,
): string {
  const covered = cov.filter((c) => c.covered).map((c) => c.role);
  const missing = cov.filter((c) => !c.covered).map((c) => c.role);
  const parts: string[] = [];
  parts.push(
    `${members.map((m) => m.name).join(" + ")} scores ${synergyDelta >= 0 ? "+" : ""}${synergyDelta} points against the best single member in a ${context.replace("-", " ")} context.`,
  );
  if (covered.length) parts.push(`Support roles covered: ${covered.join(", ")}.`);
  if (missing.length) parts.push(`Uncovered roles: ${missing.join(", ")} — this is where a substitute would improve the party most.`);
  if (conflicts.length) parts.push(`Interaction risks detected: ${conflicts.map((c) => c.title).join("; ")}.`);
  const underrated = members.filter((m) => m.underrated);
  if (underrated.length) parts.push(`Contains flagged underrated creatures (${underrated.map((m) => m.name).join(", ")}) — the effect is untested against the conventional meta.`);
  return parts.join(" ");
}

/** Candidate generation: bounded enumeration of promising pairs and triples. */
const candidateCache = new Map<string, { slugs: string[]; score: number }[]>();

export function candidateCombinations(
  context: ResearchContext,
  limit = 60,
  filter?: (c: ArkCreature) => boolean,
): { slugs: string[]; score: number }[] {
  const cacheKey = `${context}:${limit}:${filter ? "filtered" : "all"}`;
  if (!filter && candidateCache.has(cacheKey)) return candidateCache.get(cacheKey)!;
  const pool = CREATURE_BY_SLUG;
  const all = [...pool.values()].filter((c) => (filter ? filter(c) : true));
  const results: { slugs: string[]; score: number }[] = [];
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      const analysis = analyseCombination([all[i].slug, all[j].slug], context);
      results.push({ slugs: analysis.memberSlugs, score: analysis.synergyScore });
    }
  }
  // top pairs promoted to triples with a third member from a different primary role
  const topPairs = results.sort((a, b) => b.score - a.score).slice(0, Math.max(12, Math.floor(limit / 3)));
  for (const pair of topPairs) {
    const roles = pair.slugs.map((s) => pool.get(s)?.roles[0]);
    for (const c of all) {
      if (pair.slugs.includes(c.slug)) continue;
      if (roles.includes(c.roles[0])) continue;
      const analysis = analyseCombination([...pair.slugs, c.slug], context);
      results.push({ slugs: analysis.memberSlugs, score: analysis.synergyScore });
    }
  }
  const seen = new Set<string>();
  const ranked = results
    .filter((r) => {
      const key = combinationHash(r.slugs, context);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  if (!filter) candidateCache.set(cacheKey, ranked);
  return ranked;
}

/** Cross-reference helper used by the buff laboratory: every buff and who it touches. */
export function buffRelationIndex(): Map<string, { granted: string[]; affected: string[]; immune: string[] }> {
  const idx = new Map<string, { granted: string[]; affected: string[]; immune: string[] }>();
  for (const b of BUFFS) idx.set(b.slug, { granted: [], affected: [], immune: [] });
  for (const rel of ALL_BUFF_RELATIONS) {
    const entry = idx.get(rel.buffSlug);
    if (!entry) continue;
    if (rel.relation === "grants") entry.granted.push(rel.creatureSlug);
    if (rel.relation === "affected-by" || rel.relation === "counters") entry.affected.push(rel.creatureSlug);
    if (rel.relation === "immune") entry.immune.push(rel.creatureSlug);
  }
  return idx;
}
