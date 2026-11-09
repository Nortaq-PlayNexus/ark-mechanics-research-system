import {
  BOSSES,
  BUFFS,
  BUFF_BY_SLUG,
  CREATURES,
  CREATURE_BY_SLUG,
  MECHANICS,
  type ArkBuff,
  type ArkCreature,
} from "@/lib/ark";
import { analyseCombination, candidateCombinations, type ResearchContext } from "./synergy";

/**
 * HYPOTHESIS GENERATION ENGINE
 *
 * Ranking formula (documented so the ordering is auditable):
 *   priority = 0.32*impact + 0.24*novelty + 0.20*feasibility + 0.16*evidence + 0.08*confidence
 * All sub-scores are 0-100. Nothing here is a claim — a hypothesis is a question
 * the platform intends to answer with evidence.
 */

export interface HypothesisDraft {
  question: string;
  statement: string;
  rationale: string;
  domain: string;
  targetSlugs: string[];
  buffSlugs: string[];
  impact: number;
  novelty: number;
  evidence: number;
  feasibility: number;
  confidence: number;
  priority: number;
  dedupeKey: string;
  proposedBy: string;
  sourceKeys: string[];
}

export const AGENT_DOMAINS = {
  "AGENT-01": "creature-intelligence",
  "AGENT-02": "synergy",
  "AGENT-03": "raid-intelligence",
  "AGENT-04": "buff-interaction",
  "AGENT-05": "breeding",
  "AGENT-06": "pvp-meta",
  "AGENT-07": "pve-boss",
  "AGENT-08": "mechanics",
  "AGENT-09": "data-research",
  "AGENT-10": "validation",
  "AGENT-11": "meta-analysis",
  "AGENT-12": "coordination",
} as const;

export type AgentCode = keyof typeof AGENT_DOMAINS;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function score(d: Omit<HypothesisDraft, "priority">): HypothesisDraft {
  const priority = Math.round(
    (0.32 * d.impact + 0.24 * d.novelty + 0.2 * d.feasibility + 0.16 * d.evidence + 0.08 * d.confidence) * 10,
  ) / 10;
  return { ...d, priority };
}

function reliabilityOf(sourceKeys: string[]): number {
  if (sourceKeys.length === 0) return 8;
  const wiki = sourceKeys.filter((k) => k.startsWith("wiki-")).length;
  const patch = sourceKeys.filter((k) => k.startsWith("patch-")).length;
  const community = sourceKeys.filter((k) => k.startsWith("reddit-") || k.startsWith("forum-")).length;
  return clamp(20 + wiki * 20 + patch * 25 - community * 4);
}

function rarityOf(c: ArkCreature): number {
  const popularityProxy = c.tags.includes("boss-meta") ? 90 : c.tags.includes("pvp-meta") ? 80 : c.underrated ? 25 : 50;
  return clamp(100 - popularityProxy);
}

/** 1. Buff stacking / compatibility questions. */
function buffStackingHypotheses(): HypothesisDraft[] {
  const out: HypothesisDraft[] = [];
  for (const b of BUFFS) {
    if (b.confidence === "documented" && b.stacking === "does-not-stack") continue;
    const providers = CREATURES.filter((c) => (c.grants ?? []).includes(b.slug));
    out.push(
      score({
        question: `What is the exact magnitude and stacking rule of ${b.name}?`,
        statement: `${b.name} can be measured precisely, and its stacking behaviour (${b.stacking}) can be established experimentally.`,
        rationale:
          b.confidence === "documented"
            ? `The effect is documented but the stacking rule is listed as "${b.stacking}" — this is the exact gap that makes composition math impossible.`
            : `The KB carries this as ${b.confidence}; no primary source specifies the magnitude, so every composition using it is built on an assumption.`,
        domain: "buff-interaction",
        targetSlugs: providers.map((p) => p.slug),
        buffSlugs: [b.slug],
        impact: clamp(b.category === "damage" || b.category === "resistance" || b.category === "healing" ? 85 : 55),
        novelty: clamp(b.confidence === "needs-verification" ? 80 : 55),
        evidence: reliabilityOf(b.sources),
        feasibility: clamp(providers.length > 0 ? 80 : 45),
        confidence: clamp(b.confidence === "documented" ? 65 : 30),
        dedupeKey: `stack:${b.slug}`,
        proposedBy: "AGENT-04",
        sourceKeys: b.sources,
      }),
    );
  }
  return out;
}

/** 2. Cross-creature buff interaction questions (the biggest source of surprises). */
function interactionHypotheses(): HypothesisDraft[] {
  const out: HypothesisDraft[] = [];
  const providers = CREATURES.flatMap((c) => (c.grants ?? []).map((slug) => ({ creature: c, buff: BUFF_BY_SLUG.get(slug) })));
  for (const target of CREATURES) {
    for (const rel of [
      ...(target.affectedBy ?? []).map((s) => ({ slug: s, kind: "affected-by" as const })),
      ...(target.immune ?? []).map((s) => ({ slug: s, kind: "immune" as const })),
      ...(target.counters ?? []).map((s) => ({ slug: s, kind: "counters" as const })),
    ]) {
      const buff = BUFF_BY_SLUG.get(rel.slug);
      if (!buff) continue;
      for (const p of providers) {
        if (!p.buff || p.creature.slug === target.slug) continue;
        if (p.buff.slug !== buff.slug && p.buff.category !== buff.category) continue;
        const sameBuff = p.buff.slug === buff.slug;
        out.push(
          score({
            question: `How does ${p.creature.name}'s ${p.buff.name} interact with ${target.name}?`,
            statement: `${p.creature.name} and ${target.name} in the same party produce a measurable outcome that differs from the sum of their individual contributions.`,
            rationale: sameBuff
              ? `${target.name} is recorded as ${rel.kind} of ${buff.name}. If the effect is ally-facing this is a direct party interaction; if it is enemy-facing it defines a counter relationship.`
              : `${p.buff.name} (${p.buff.category}) and ${buff.name} (${buff.category}) can both be present in the same engagement. The combination rule is undocumented.`,
            domain: "synergy",
            targetSlugs: [p.creature.slug, target.slug],
            buffSlugs: [p.buff.slug, buff.slug],
            impact: clamp(rel.kind === "immune" ? 70 : 80),
            novelty: clamp(rel.kind === "immune" ? 85 : 65),
            evidence: clamp((reliabilityOf(p.buff.sources) + reliabilityOf(buff.sources)) / 2),
            feasibility: clamp(70 + (p.creature.tier === "small" || p.creature.tier === "shoulder" ? 15 : 0)),
            confidence: clamp(rel.kind === "affected-by" ? 45 : 30),
            dedupeKey: `interact:${p.creature.slug}:${target.slug}:${buff.slug}`,
            proposedBy: "AGENT-02",
            sourceKeys: [...new Set([...p.buff.sources, ...buff.sources])],
          }),
        );
      }
    }
  }
  return out;
}

/** 3. Underrated creatures re-scored for combination potential. */
function underratedHypotheses(): HypothesisDraft[] {
  const out: HypothesisDraft[] = [];
  for (const c of CREATURES.filter((x) => x.underrated)) {
    for (const context of ["pvp-open", "raid-assault", "raid-defence"] as ResearchContext[]) {
      const best = candidateCombinations(context, 40).find((r) => r.slugs.includes(c.slug));
      const partner = best?.slugs.find((s) => s !== c.slug) ?? "yutyrannus";
      out.push(
        score({
          question: `Does ${c.name} outperform a conventional meta creature when correctly supported?`,
          statement: `A ${context.replace("-", " ")} composition built around ${c.name} (with ${CREATURE_BY_SLUG.get(partner)?.name ?? partner}) matches or beats a same-cost conventional composition.`,
          rationale: `${c.notes} The KB flags it as underrated; the claim is untested in a controlled comparison.`,
          domain: "meta-analysis",
          targetSlugs: [c.slug, partner],
          buffSlugs: c.grants ?? [],
          impact: clamp(60 + rarityOf(c) * 0.3),
          novelty: clamp(rarityOf(c)),
          evidence: reliabilityOf(c.sources),
          feasibility: clamp(c.tier === "large" || c.tier === "titan" ? 55 : 85),
          confidence: clamp(35 + (c.confidence === "documented" ? 20 : 0)),
          dedupeKey: `underrated:${c.slug}:${context}`,
          proposedBy: "AGENT-06",
          sourceKeys: c.sources,
        }),
      );
    }
  }
  return out;
}

/** 4. Undocumented mechanics shortlist. */
function mechanicsHypotheses(): HypothesisDraft[] {
  return MECHANICS.map((m) =>
    score({
      question: `${m.title} — what is the actual behaviour?`,
      statement: `${m.documentedBehaviour} The platform can establish the real rule through a designed experiment.`,
      rationale: `${m.description} Documented behaviour: ${m.documentedBehaviour} Observed reports: ${m.observedBehaviour}`,
      domain: "mechanics",
      targetSlugs: [],
      buffSlugs: [],
      impact: clamp(m.tags.includes("math") || m.tags.includes("stacking") ? 88 : 70),
      novelty: clamp(m.status === "needs-verification" ? 90 : 60),
      evidence: reliabilityOf(m.sourceKeys),
      feasibility: clamp(m.tags.includes("server-settings") ? 45 : 80),
      confidence: clamp(m.confidence === "documented" ? 70 : m.confidence === "community-reported" ? 35 : 15),
      dedupeKey: `mechanic:${m.slug}`,
      proposedBy: "AGENT-08",
      sourceKeys: m.sourceKeys,
    }),
  );
}

/** 5. Player-buff x creature-aura interactions. */
function playerBuffHypotheses(): HypothesisDraft[] {
  const out: HypothesisDraft[] = [];
  const playerBuffs = BUFFS.filter((b) => b.sourceType === "food" || b.sourceType === "equipment");
  const creatureAuras = BUFFS.filter((b) => b.scope === "aura" || b.scope === "allies");
  for (const pb of playerBuffs) {
    for (const ca of creatureAuras) {
      out.push(
        score({
          question: `Do ${pb.name} and ${ca.name} combine, and how?`,
          statement: `A rider under ${pb.name} on a mount benefiting from ${ca.name} receives a combined modifier that can be measured against each effect alone.`,
          rationale: `Player-sourced and creature-sourced modifiers are almost never tested together. The KB records ${pb.name} as ${pb.confidence} and ${ca.name} as ${ca.confidence}.`,
          domain: "buff-interaction",
          targetSlugs: ca.sourceSlug ? [ca.sourceSlug] : [],
          buffSlugs: [pb.slug, ca.slug],
          impact: clamp(pb.category === "resistance" || pb.category === "healing" ? 82 : 60),
          novelty: 88,
          evidence: clamp((reliabilityOf(pb.sources) + reliabilityOf(ca.sources)) / 2),
          feasibility: 92,
          confidence: clamp(pb.confidence === "documented" && ca.confidence === "documented" ? 50 : 25),
          dedupeKey: `playerbuff:${pb.slug}:${ca.slug}`,
          proposedBy: "AGENT-04",
          sourceKeys: [...new Set([...pb.sources, ...ca.sources])],
        }),
      );
    }
  }
  return out;
}

/** 6. Boss-specific composition questions with arena constraints. */
function bossHypotheses(): HypothesisDraft[] {
  return BOSSES.map((b) =>
    score({
      question: `What is the optimal composition for ${b.name} under its arena restrictions?`,
      statement: `A composition satisfying ${b.restrictions.join("; ")} exists that outperforms the conventional benchmark for this boss.`,
      rationale: `${b.notes} Constraints: ${b.restrictions.join("; ")}. Known counter patterns: ${b.counters.join(", ")}.`,
      domain: "pve-boss",
      targetSlugs: b.recommendedSlugs,
      buffSlugs: [],
      impact: 80,
      novelty: clamp(b.recommendedSlugs.some((s) => CREATURE_BY_SLUG.get(s)?.underrated) ? 80 : 45),
      evidence: 55,
      feasibility: clamp(b.restrictions.includes("Radiation") ? 60 : 75),
      confidence: 40,
      dedupeKey: `boss:${b.slug}`,
      proposedBy: "AGENT-07",
      sourceKeys: ["wiki-root"],
    }),
  );
}

/** 7. Raid soak / damage-typing questions. */
function raidHypotheses(): HypothesisDraft[] {
  const soakers = ["rock-elemental", "doedicurus", "titanosaur", "stegosaurus", "paraceratherium"];
  const defenders = ["velonasaur", "mek", "rock-elemental", "paraceratherium"];
  const out: HypothesisDraft[] = [];
  for (const s of soakers) {
    const c = CREATURE_BY_SLUG.get(s);
    if (!c) continue;
    out.push(
      score({
        question: `What is the effective turret soak value of a ${c.name} under projectile and rocket fire?`,
        statement: `${c.name}'s soak performance against autoturrets differs from rocket/heavy turret performance by a measurable, documentable factor.`,
        rationale: `${c.notes} Damage typing decides which soak platform to use, and the KB does not contain per-damage-type soak numbers.`,
        domain: "raid-intelligence",
        targetSlugs: [s],
        buffSlugs: [],
        impact: 85,
        novelty: 55,
        evidence: reliabilityOf(c.sources),
        feasibility: clamp(c.tier === "titan" ? 35 : 70),
        confidence: 30,
        dedupeKey: `soak:${s}`,
        proposedBy: "AGENT-03",
        sourceKeys: c.sources,
      }),
    );
  }
  for (const d of defenders) {
    const c = CREATURE_BY_SLUG.get(d);
    if (!c) continue;
    out.push(
      score({
        question: `How does a ${c.name} based defensive formation perform per tame slot?`,
        statement: `A defensive formation anchored by ${c.name} outperforms an equal-slot turret-only defence when maintenance cost is included.`,
        rationale: `${c.notes} Defence is usually evaluated in structure terms only; creature-based defence is rarely modelled per slot.`,
        domain: "defence",
        targetSlugs: [d, ...defenders.filter((x) => x !== d).slice(0, 2)],
        buffSlugs: [],
        impact: 72,
        novelty: 70,
        evidence: reliabilityOf(c.sources),
        feasibility: 70,
        confidence: 30,
        dedupeKey: `defence:${d}`,
        proposedBy: "AGENT-03",
        sourceKeys: c.sources,
      }),
    );
  }
  return out;
}

/** 8. Counter-matrix questions for PvP. */
function counterHypotheses(): HypothesisDraft[] {
  const control = CREATURES.filter((c) => c.profile.cc >= 70);
  const meta = ["rex", "giganotosaurus", "shadowmane", "managarmr", "rock-drake", "reaper-king"];
  const out: HypothesisDraft[] = [];
  for (const c of control) {
    for (const m of meta) {
      const target = CREATURE_BY_SLUG.get(m);
      if (!target) continue;
      out.push(
        score({
          question: `Can ${c.name} neutralise a ${target.name} line cost-effectively?`,
          statement: `${c.name}'s control effect removes more enemy value per tame slot than the ${target.name} line removes in return.`,
          rationale: `${c.name} has a control rating of ${c.profile.cc}/100 and costs ${c.tier === "shoulder" || c.tier === "small" ? "a fraction" : "less"} of a ${target.name} line to produce. ${c.notes}`,
          domain: "pvp-meta",
          targetSlugs: [c.slug, m],
          buffSlugs: c.grants ?? [],
          impact: clamp(65 + (c.tier === "shoulder" || c.tier === "small" ? 20 : 0)),
          novelty: clamp(rarityOf(c)),
          evidence: reliabilityOf(c.sources),
          feasibility: clamp(c.tier === "large" ? 55 : 88),
          confidence: 30,
          dedupeKey: `counter:${c.slug}:${m}`,
          proposedBy: "AGENT-06",
          sourceKeys: c.sources,
        }),
      );
    }
  }
  return out;
}

/** 9. Map / mode gating questions. */
function environmentHypotheses(): HypothesisDraft[] {
  const gated = CREATURES.filter((c) => !c.maps.includes("island") || c.maps.length <= 6);
  const out: HypothesisDraft[] = [];
  for (const c of gated.slice(0, 24)) {
    out.push(
      score({
        question: `How does map availability change ${c.name}'s strategic value?`,
        statement: `${c.name} is unavailable on ${["island", "scorched", "ragnarok", "valguero", "crystal-isles", "genesis", "genesis-2", "aberration", "extinction", "lost-island", "fjordur"]
          .filter((m) => !c.maps.includes(m))
          .slice(0, 4)
          .join(", ")}, which changes which compositions are possible there.`,
        rationale: `${c.notes} Composition theory that ignores spawn tables produces recommendations that cannot be executed on most servers.`,
        domain: "mechanics",
        targetSlugs: [c.slug],
        buffSlugs: c.grants ?? [],
        impact: 55,
        novelty: 60,
        evidence: reliabilityOf(["wiki-spawn-maps"]),
        feasibility: 95,
        confidence: 70,
        dedupeKey: `map:${c.slug}`,
        proposedBy: "AGENT-09",
        sourceKeys: ["wiki-spawn-maps", ...c.sources],
      }),
    );
  }
  return out;
}

/** 10. Cross-check: does any combination beat the conventional benchmark? */
function benchmarkHypotheses(): HypothesisDraft[] {
  const out: HypothesisDraft[] = [];
  const benchmarks: Record<string, string[]> = {
    "boss-arena": ["rex", "daeodon", "yutyrannus"],
    "raid-assault": ["rock-elemental", "daeodon", "yutyrannus"],
    "raid-defence": ["velonasaur", "daeodon", "yutyrannus"],
    "pvp-open": ["shadowmane", "daeodon", "yutyrannus"],
  };
  for (const [context, slugs] of Object.entries(benchmarks)) {
    const baseline = analyseCombination(slugs, context as ResearchContext);
    const candidates = candidateCombinations(context as ResearchContext, 25);
    for (const cand of candidates.slice(0, 8)) {
      const alt = analyseCombination(cand.slugs, context as ResearchContext);
      if (alt.partyScore <= baseline.partyScore) continue;
      out.push(
        score({
          question: `Does ${alt.members.map((m) => m.name).join(" + ")} beat the conventional ${context.replace("-", " ")} benchmark?`,
          statement: `In the platform's model this composition scores ${alt.partyScore} vs the benchmark's ${baseline.partyScore} — a ${Math.round(alt.partyScore - baseline.partyScore)} point advantage that requires in-game confirmation.`,
          rationale: `${alt.rationale} Benchmark: ${baseline.members.map((m) => m.name).join(" + ")} (${baseline.partyScore}).`,
          domain: "meta-analysis",
          targetSlugs: cand.slugs,
          buffSlugs: alt.documentedBuffs.map((b) => b.slug),
          impact: clamp(60 + (alt.partyScore - baseline.partyScore) * 1.5),
          novelty: clamp(alt.members.some((m) => m.underrated) ? 85 : 50),
          evidence: clamp((reliabilityOf(alt.documentedBuffs.flatMap((b) => b.sources)) + alt.synergyScore) / 2),
          feasibility: clamp(alt.cost.breedingLoad <= baseline.cost.breedingLoad ? 85 : 55),
          confidence: clamp(20 + alt.synergyScore * 0.4),
          dedupeKey: `benchmark:${alt.hash}`,
          proposedBy: "AGENT-11",
          sourceKeys: ["wiki-root", ...new Set(alt.documentedBuffs.flatMap((b) => b.sources))],
        }),
      );
    }
  }
  return out;
}

export function generateHypotheses(): HypothesisDraft[] {
  const all = [
    ...buffStackingHypotheses(),
    ...interactionHypotheses(),
    ...underratedHypotheses(),
    ...mechanicsHypotheses(),
    ...playerBuffHypotheses(),
    ...bossHypotheses(),
    ...raidHypotheses(),
    ...counterHypotheses(),
    ...environmentHypotheses(),
    ...benchmarkHypotheses(),
  ];
  const seen = new Set<string>();
  return all
    .filter((h) => {
      if (seen.has(h.dedupeKey)) return false;
      seen.add(h.dedupeKey);
      return true;
    })
    .sort((a, b) => b.priority - a.priority);
}

export function topHypotheses(limit: number): HypothesisDraft[] {
  return generateHypotheses().slice(0, limit);
}

export type { ArkBuff };
