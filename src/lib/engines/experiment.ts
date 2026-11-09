import type { ExperimentConditions } from "@/db/schema";
import type { HypothesisDraft } from "./hypothesis";

/**
 * EXPERIMENT DESIGN ENGINE
 *
 * Integrity rules enforced here:
 * - Every generated experiment starts as `pending-manual-testing`.
 * - Baselines and measurements are null until a human records real numbers.
 * - The platform will never write a numeric result, screenshot or video reference
 *   on its own. `importResult()` is the only path to a validated classification.
 */

export type ExperimentStatus =
  | "literature-derived"
  | "simulation-only"
  | "pending-manual-testing"
  | "in-progress"
  | "recorded";

export interface ExperimentDraft {
  code: string;
  hypothesisCode: string;
  title: string;
  question: string;
  status: ExperimentStatus;
  conditions: ExperimentConditions;
  procedure: string[];
  baseline: Record<string, number | null> | null;
  measurements: Record<string, number | null> | null;
  evidence: { kind: string; uri: string; note: string }[];
  results: string;
  limitations: string[];
  confidence: number;
  classification: string;
  replicates: number;
  assignedAgent: string;
}

export const DEFAULT_CONDITIONS: ExperimentConditions = {
  gameVersion: "ARK: Survival Evolved — current live build (record exact version at test time)",
  map: "The Island",
  gameMode: "Single-player with default official-equivalent settings (control configuration)",
  serverSettings:
    "Official defaults: 1.0 taming, 1.0 harvest, 1.0 XP, no multipliers on damage or resistance. Record and publish any deviation.",
  equipment: "Primitive saddles and no armour unless the hypothesis specifically tests imprint/saddle scaling.",
  creatureLevels: "Wild-caught baseline creatures at identical level (record level) OR identical bred statistics.",
  creatureStats: "0 points invested for baseline measurements; record points added for any scaled runs.",
};

const DOMAIN_PROCEDURES: Record<string, string[]> = {
  "buff-interaction": [
    "Spawn/place creature A (buff source) and the test target creature in a flat, enclosed test area with no wild interference.",
    "Run 1 — BASELINE: measure the target's output/survival with no buffs applied. Record 10 samples (damage per swing against a fixed-HP target, or HP lost over a fixed time window under a fixed attacker).",
    "Run 2 — BUFF A ONLY: apply buff A and repeat the same 10-sample measurement.",
    "Run 3 — BUFF B ONLY: apply buff B and repeat the same 10-sample measurement.",
    "Run 4 — BOTH: apply A and B and repeat the same 10-sample measurement.",
    "Compute combined/expected from runs 2 and 3 and compare against run 4 to classify the interaction as multiplicative, additive, overriding or non-stacking.",
    "Repeat the full sequence 3 times on separate sessions to control for drift, and re-verify after any game patch.",
    "Record game version, server settings, creature levels, stat points and saddle quality alongside every sample.",
  ],
  synergy: [
    "Assemble the proposed combination and a same-cost comparison combination containing only the strongest single member.",
    "BASELINE: run the strongest single member alone against the standard test target and record time-to-kill and damage taken.",
    "COMBINED: run the full combination and record the same metrics.",
    "Compute the difference and express it as a percentage of baseline.",
    "Repeat 3 times; alternate the order of runs to control for positioning and pathing luck.",
    "Record every buff observed active at the moment of measurement (screenshot the buff bar for evidence).",
  ],
  "raid-intelligence": [
    "Build an identical test structure (or use a server test plot) with a fixed number of autoturrets and a fixed rocket turret.",
    "BASELINE: measure structure damage per second from the damage creature alone and soak time for the platform alone.",
    "TEST: run the full formation and measure structure time-to-break and platform survival time.",
    "Measure turret ammunition consumed per point of structure damage as the resource-efficiency metric.",
    "Repeat for both projectile and explosive damage types — soak platforms behave differently against each.",
    "Record turret settings, structure tier and saddle quality with every run.",
  ],
  defence: [
    "Set up two identical base mock-ups: one turret-only, one creature-anchored with the same tame-slot cost.",
    "Run the same scripted attack against each and record structures lost, attackers lost and time-to-breach.",
    "Include a maintenance-cost measurement: ammunition consumed, food consumed and healing items consumed.",
    "Repeat 3 times to control for attacker pathing.",
  ],
  "pvp-meta": [
    "Run a controlled duel: the candidate control creature vs the meta creature, both at identical level and saddle quality, with the same rider skill if possible.",
    "Record rounds won, time-to-neutralise and resources consumed per neutralisation.",
    "Repeat 5 times and alternate starting positions.",
    "Then repeat with the candidate supported by a buffer/healer to test whether the relationship changes when supported.",
  ],
  "pve-boss": [
    "Attempt the boss with the conventional benchmark composition at the recorded difficulty and record time-to-kill, damage taken and creatures lost.",
    "Attempt the same boss with the experimental composition under identical conditions and difficulty.",
    "Record every arena restriction that was violated or constrained the composition.",
    "Repeat each configuration 3 times.",
    "Compare time-to-kill and resource cost per attempt, not just success/failure.",
  ],
  mechanics: [
    "Reproduce the reported behaviour in a controlled single-player environment on default settings.",
    "Record the exact conditions: map, mode, version, creature levels, buffs active, day/night, water state and temperature.",
    "Vary exactly one condition at a time to identify the trigger.",
    "Attempt the same reproduction on an official-rules server to detect mode drift.",
    "Classify the result as: legitimate mechanic, exploit, or patched/obsolete behaviour.",
  ],
  breeding: [
    "Record parent statistics before mating and offspring statistics after birth for at least 10 offspring.",
    "Track mutation counter state and imprint percentage for each generation.",
    "Compare role performance (the specific combat role) between the pre-breed and post-breed line under identical test conditions.",
  ],
  "creature-intelligence": [
    "Enumerate the creature's abilities in-game and compare against the KB entry, recording any undocumented behaviour.",
    "For each suspected hidden mechanic, isolate it by removing other variables (no other buffs, no other creatures).",
    "Measure the affected value with and without the ability active, 10 samples per condition.",
  ],
  "data-research": [
    "Collect the same claim from at least three independent sources and record the version each refers to.",
    "Where sources disagree, design the minimal in-game test that discriminates between them.",
  ],
  "meta-analysis": [
    "Take the top-ranked combinations from the synergy engine and run each against the conventional benchmark under identical conditions.",
    "Record which ranking positions survive contact with real measurements.",
  ],
  validation: [
    "Confirm the hypothesis, then define the baseline and the single variable under test.",
    "Execute the domain-specific procedure and record raw samples, not just averages.",
  ],
  coordination: [
    "Review the discovery queue and confirm each discovery's evidence chain before publication.",
  ],
};

export function designExperiment(hypothesis: HypothesisDraft, index: number): ExperimentDraft {
  const procedure = DOMAIN_PROCEDURES[hypothesis.domain] ?? DOMAIN_PROCEDURES.mechanics;
  return {
    code: `EXP-${String(index).padStart(4, "0")}`,
    hypothesisCode: hypothesis.dedupeKey,
    title: hypothesis.question,
    question: hypothesis.statement,
    status: "pending-manual-testing",
    conditions: { ...DEFAULT_CONDITIONS },
    procedure,
    baseline: null,
    measurements: null,
    evidence: [],
    results: "",
    limitations: [
      "No measurements have been recorded yet: this is a designed experiment awaiting manual execution.",
      "Confounds to control: server multipliers, imprint bonus, saddle quality, rider skill, wild level variance, lag, and buff radius geometry.",
      `Knowledge-base confidence for the underlying data: ${hypothesis.confidence}/100 (evidence score ${hypothesis.evidence}/100).`,
    ],
    confidence: 0,
    classification: "UNVERIFIED",
    replicates: 0,
    assignedAgent: "AGENT-10",
  };
}

export interface ImportedMeasurement {
  metric: string;
  baseline: number | null;
  experimental: number | null;
  samples?: number;
  /** "higher" (default) = a bigger number is better; "lower" = a smaller number is better (e.g. time-to-kill). */
  direction?: "higher" | "lower";
}

export interface ValidatedResult {
  classification: string;
  confidence: number;
  results: string;
  deltas: {
    metric: string;
    baseline: number | null;
    experimental: number | null;
    deltaPct: number | null;
    improvementPct: number | null;
  }[];
  limitations: string[];
  evidenceQuality: string;
}

/**
 * The only path to a validated classification: a human supplies real measurements.
 * Everything the platform concludes here is derived from those numbers.
 */
export function importResults(input: {
  measurements: ImportedMeasurement[];
  replicates: number;
  notes: string;
  evidence?: { kind: string; uri: string; note: string }[];
  independentlyReplicatedBy?: string | null;
}): ValidatedResult {
  const deltas = input.measurements.map((m) => {
    const deltaPct =
      m.baseline && m.experimental && m.baseline !== 0
        ? Math.round(((m.experimental - m.baseline) / Math.abs(m.baseline)) * 1000) / 10
        : null;
    const improvementPct = deltaPct === null ? null : m.direction === "lower" ? -deltaPct : deltaPct;
    return { metric: m.metric, baseline: m.baseline, experimental: m.experimental, deltaPct, improvementPct };
  });

  const measured = deltas.filter((d) => d.improvementPct !== null);
  const avgImprovement =
    measured.length > 0 ? measured.reduce((a, b) => a + (b.improvementPct ?? 0), 0) / measured.length : null;
  // consistency is judged on *improvement* direction, so a reduction in time-to-kill
  // counts as agreement with an increase in damage rather than as a contradiction.
  const consistent =
    measured.length > 0 && measured.every((d) => Math.sign(d.improvementPct ?? 0) === Math.sign(measured[0].improvementPct ?? 1));
  const hasEvidence = (input.evidence?.length ?? 0) > 0;

  let classification = "UNVERIFIED";
  if (measured.length === 0) classification = "UNVERIFIED";
  else if (input.independentlyReplicatedBy) classification = "INDEPENDENTLY-REPLICATED";
  else if (input.replicates >= 3 && consistent && hasEvidence) classification = "EXPERIMENTALLY-CONFIRMED";
  else if (input.replicates >= 2 || (consistent && measured.length >= 2)) classification = "PARTIALLY-VALIDATED";
  else classification = "UNVERIFIED";

  if (measured.length === 0) {
    return {
      classification: "UNVERIFIED",
      confidence: 0,
      results: `${input.notes}\n\nNo comparable measurements were supplied, so no conclusion is drawn.`,
      deltas,
      evidenceQuality: "none",
      limitations: ["No comparable measurements were supplied, so no conclusion can be drawn."],
    };
  }
  const magnitudeScore = avgImprovement === null ? 0 : Math.min(40, Math.abs(avgImprovement) * 1.5);
  const replicateScore = Math.min(25, input.replicates * 8);
  const evidenceScore = hasEvidence ? 20 : 5;
  const consistencyScore = consistent ? 15 : 0;
  const confidence = Math.max(0, Math.min(100, Math.round(magnitudeScore + replicateScore + evidenceScore + consistencyScore)));

  const results =
    measured.length === 0
      ? `${input.notes}\n\nNo comparable measurements were supplied, so no conclusion is drawn.`
      : `${input.notes}\n\n${measured
          .map(
            (d) =>
              `${d.metric}: ${d.baseline} → ${d.experimental} (${d.deltaPct}% raw, ${d.improvementPct}% improvement)`,
          )
          .join("\n")}\n\nMean measured improvement: ${avgImprovement !== null ? `${avgImprovement.toFixed(1)}%` : "n/a"} across ${input.replicates} replicate run(s).`;

  return {
    classification,
    confidence,
    results,
    deltas,
    evidenceQuality: hasEvidence ? (input.independentlyReplicatedBy ? "independent-replication" : "recorded-evidence") : "recorded-numbers-only",
    limitations: [
      input.replicates < 3
        ? `Only ${input.replicates} replicate run(s) recorded; statistical confidence is limited.`
        : `${input.replicates} replicate runs recorded.`,
      hasEvidence ? "Evidence attachments recorded." : "No evidence attachments recorded — classification is capped at PARTIALLY-VALIDATED.",
      "Server multipliers and game version at test time must be recorded with the result for it to remain comparable.",
    ],
  };
}
