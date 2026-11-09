/**
 * ARK OMNISCIENCE — automated engine tests.
 *
 * Run with:  npx tsx --test tests/ark.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_BUFF_RELATIONS,
  BUFFS,
  CREATURES,
  CREATURE_BY_SLUG,
  ORPHAN_BUFF_REFERENCES,
} from "../src/lib/ark";
import { analyseBuffPair, analyseCombination, candidateCombinations, combinationHash } from "../src/lib/engines/synergy";
import { generateHypotheses } from "../src/lib/engines/hypothesis";
import { designExperiment, importResults, DEFAULT_CONDITIONS } from "../src/lib/engines/experiment";
import { AGENTS, AGENT_BY_CODE } from "../src/lib/agents/registry";
import { runAgent } from "../src/lib/agents/execution";

/* ------------------------------------------------------- knowledge base */

test("knowledge base is internally consistent", () => {
  assert.ok(CREATURES.length >= 70, "expected a substantial creature roster");
  assert.ok(BUFFS.length >= 50, "expected a substantial buff roster");
  assert.deepEqual(ORPHAN_BUFF_REFERENCES, [], "every referenced buff must be defined");
  assert.equal(new Set(CREATURES.map((c) => c.slug)).size, CREATURES.length, "creature slugs must be unique");
  assert.equal(new Set(BUFFS.map((b) => b.slug)).size, BUFFS.length, "buff slugs must be unique");
});

test("every creature has at least one ability and a bounded profile", () => {
  for (const c of CREATURES) {
    assert.ok(c.abilities.length >= 1, `${c.slug} has no abilities`);
    for (const [key, value] of Object.entries(c.profile)) {
      assert.ok(value >= 0 && value <= 100, `${c.slug}.${key} profile value out of range: ${value}`);
    }
    assert.ok(c.notes.length > 40, `${c.slug} needs research notes`);
  }
});

test("buffs referencing a creature source resolve to a known creature", () => {
  for (const b of BUFFS) {
    if (b.sourceSlug) {
      assert.ok(CREATURE_BY_SLUG.has(b.sourceSlug), `buff ${b.slug} references unknown source ${b.sourceSlug}`);
    }
  }
});

test("all buff relations resolve on both sides", () => {
  for (const rel of ALL_BUFF_RELATIONS) {
    assert.ok(CREATURE_BY_SLUG.has(rel.creatureSlug), `relation references unknown creature ${rel.creatureSlug}`);
    assert.ok(BUFFS.some((b) => b.slug === rel.buffSlug), `relation references unknown buff ${rel.buffSlug}`);
  }
});

/* -------------------------------------------------------- synergy engine */

test("combination analysis is deterministic and hash-stable", () => {
  const a = analyseCombination(["yutyrannus", "daeodon"], "boss-arena");
  const b = analyseCombination(["daeodon", "yutyrannus"], "boss-arena");
  assert.equal(a.partyScore, b.partyScore, "member order must not change the score");
  assert.equal(combinationHash(["a", "b"], "ctx"), combinationHash(["b", "a"], "ctx"));
  assert.notEqual(combinationHash(["a", "b"], "ctx"), combinationHash(["a", "b"], "other"));
});

test("documented damage multipliers are applied, never invented", () => {
  const withYuty = analyseCombination(["yutyrannus", "rex"], "boss-arena");
  assert.equal(withYuty.estimatedDamageMultiplier, 1.25, "Yuty courage roar is the only documented numeric melee buff here");
  const withoutYuty = analyseCombination(["rex", "therizinosaurus"], "boss-arena");
  assert.equal(withoutYuty.estimatedDamageMultiplier, 1, "no numeric multiplier may be invented");
});

test("party must beat its best single member to count as synergy", () => {
  const analysis = analyseCombination(["yutyrannus", "daeodon", "rex"], "boss-arena");
  assert.ok(analysis.partyScore >= analysis.bestSingleScore, "a supported party should not be worse than its best member");
  assert.ok(analysis.meanMemberScore > 0);
});

test("conflict detection: charge light strips your own Reaper", () => {
  const analysis = analyseCombination(["light-pet", "reaper-king"], "pvp-open");
  const titles = analysis.conflicts.map((c) => c.title);
  assert.ok(titles.some((t) => /charge light/i.test(t)), "expected the charge-light/Reaper conflict");
});

test("conflict detection: fear roar friendly fire with small allies", () => {
  const analysis = analyseCombination(["yutyrannus", "microraptor", "compsognathus"], "pvp-open");
  assert.ok(analysis.conflicts.some((c) => /fear roar/i.test(c.title)));
});

test("buff pair classification is sound", () => {
  const yuty = BUFFS.find((b) => b.slug === "yuty-courage-roar")!;
  const daeodon = BUFFS.find((b) => b.slug === "daeodon-heal-aura")!;
  const same = analyseBuffPair(yuty, yuty);
  assert.equal(same.verdict, "shared-source-refresh");
  const cross = analyseBuffPair(yuty, daeodon);
  assert.equal(cross.verdict, "stacks", "different categories with no recorded conflict should be expected to compound");
});

test("candidate generation is bounded, ranked and memoised", () => {
  const first = candidateCombinations("raid-assault", 20);
  const second = candidateCombinations("raid-assault", 20);
  assert.equal(first.length, second.length);
  assert.ok(first.length > 0 && first.length <= 20);
  for (let i = 1; i < first.length; i += 1) {
    assert.ok(first[i - 1].score >= first[i].score, "candidates must be sorted by score");
  }
});

/* ---------------------------------------------------- hypothesis engine */

test("hypotheses are unique, bounded and ranked", () => {
  const all = generateHypotheses();
  assert.ok(all.length > 100, `expected a large hypothesis set, got ${all.length}`);
  assert.equal(new Set(all.map((h) => h.dedupeKey)).size, all.length, "dedupe keys must be unique");
  for (const h of all) {
    for (const key of ["impact", "novelty", "evidence", "feasibility", "confidence"] as const) {
      assert.ok(h[key] >= 0 && h[key] <= 100, `${h.dedupeKey}.${key} out of range`);
    }
    assert.ok(h.priority > 0 && h.priority <= 100, `${h.dedupeKey}.priority out of range`);
    assert.ok(AGENT_BY_CODE.has(h.proposedBy), `${h.dedupeKey} proposed by unknown agent`);
  }
  for (let i = 1; i < all.length; i += 1) {
    assert.ok(all[i - 1].priority >= all[i].priority, "hypotheses must be sorted by priority");
  }
});

test("the division covers all twelve agents", () => {
  assert.equal(AGENTS.length, 12);
  for (const agent of AGENTS) {
    const result = runAgent(agent.code);
    assert.equal(result.agentCode, agent.code);
    assert.ok(result.logs.length > 0, `${agent.code} should log its activity`);
    assert.ok(result.findings.length > 0, `${agent.code} should produce findings`);
    for (const f of result.findings) {
      assert.ok(["UNVERIFIED", "SOURCE-SUPPORTED", "PARTIALLY-VALIDATED"].includes(f.classification));
      assert.ok(f.confidenceScore >= 0 && f.confidenceScore <= 100);
      assert.ok(f.summary.length > 20);
    }
    for (const f of result.findings) {
      for (const slug of f.creatureSlugs) {
        assert.ok(CREATURE_BY_SLUG.has(slug), `${agent.code} referenced unknown creature ${slug}`);
      }
    }
  }
});

test("no agent run may produce a validated classification", () => {
  for (const agent of AGENTS) {
    const result = runAgent(agent.code);
    for (const f of result.findings) {
      assert.notEqual(f.classification, "EXPERIMENTALLY-CONFIRMED", "agents must not self-validate");
      assert.notEqual(f.classification, "INDEPENDENTLY-REPLICATED", "agents must not self-validate");
    }
  }
});

/* ----------------------------------------------------- experiment engine */

test("designed experiments never contain results", () => {
  const draft = designExperiment(
    {
      question: "q",
      statement: "s",
      rationale: "r",
      domain: "buff-interaction",
      targetSlugs: [],
      buffSlugs: [],
      impact: 80,
      novelty: 70,
      evidence: 50,
      feasibility: 90,
      confidence: 30,
      priority: 70,
      dedupeKey: "test",
      proposedBy: "AGENT-04",
      sourceKeys: [],
    },
    1,
  );
  assert.equal(draft.status, "pending-manual-testing");
  assert.equal(draft.baseline, null);
  assert.equal(draft.measurements, null);
  assert.equal(draft.replicates, 0);
  assert.equal(draft.classification, "UNVERIFIED");
  assert.equal(draft.confidence, 0);
  assert.ok(draft.procedure.length >= 4, "a designed experiment needs a real procedure");
  assert.ok(draft.limitations.length >= 2);
  assert.equal(draft.conditions.gameVersion, DEFAULT_CONDITIONS.gameVersion);
});

test("importing no measurements yields UNVERIFIED", () => {
  const result = importResults({ measurements: [], replicates: 0, notes: "nothing measured" });
  assert.equal(result.classification, "UNVERIFIED");
  assert.equal(result.confidence, 0);
});

test("consistent replicates with evidence promote the classification", () => {
  const partial = importResults({
    measurements: [{ metric: "damage", baseline: 100, experimental: 150 }],
    replicates: 1,
    notes: "one run",
  });
  assert.equal(partial.classification, "UNVERIFIED");

  // time-to-kill is a lower-is-better metric, so it must be marked as such or the
  // classifier will treat the reduction as a contradiction.
  const confirmed = importResults({
    measurements: [
      { metric: "damage", baseline: 100, experimental: 150 },
      { metric: "time-to-kill", baseline: 60, experimental: 40, direction: "lower" as const },
    ],
    replicates: 3,
    notes: "three consistent runs",
    evidence: [{ kind: "screenshot", uri: "file://evidence/1.png", note: "buff bar visible" }],
  });
  assert.equal(confirmed.classification, "EXPERIMENTALLY-CONFIRMED");
  assert.ok(confirmed.confidence > partial.confidence);

  const replicated = importResults({
    measurements: [{ metric: "damage", baseline: 100, experimental: 149 }],
    replicates: 3,
    notes: "second operator",
    evidence: [{ kind: "video", uri: "file://evidence/2.mp4", note: "full run" }],
    independentlyReplicatedBy: "second operator session",
  });
  assert.equal(replicated.classification, "INDEPENDENTLY-REPLICATED");
});

test("inconsistent deltas prevent confirmation", () => {
  const result = importResults({
    measurements: [
      { metric: "a", baseline: 100, experimental: 150 },
      { metric: "b", baseline: 100, experimental: 50 },
    ],
    replicates: 3,
    notes: "contradictory",
    evidence: [{ kind: "screenshot", uri: "file://x.png", note: "" }],
  });
  assert.notEqual(result.classification, "EXPERIMENTALLY-CONFIRMED");
});

test("delta percentages are computed from real numbers only", () => {
  const result = importResults({
    measurements: [
      { metric: "damage", baseline: 100, experimental: 152 },
      { metric: "unknown", baseline: null, experimental: null },
    ],
    replicates: 2,
    notes: "mixed",
  });
  const damage = result.deltas.find((d) => d.metric === "damage");
  const unknown = result.deltas.find((d) => d.metric === "unknown");
  assert.equal(damage?.deltaPct, 52);
  assert.equal(unknown?.deltaPct, null);
});
