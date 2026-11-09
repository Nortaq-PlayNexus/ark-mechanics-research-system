import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  agents,
  abilities,
  bosses,
  breedingPrograms,
  buffs,
  campaigns,
  creatureBuffs,
  creatures,
  mechanics,
  patchHistory,
  researchTasks,
  settings,
  sources,
} from "@/db/schema";
import {
  ALL_BUFF_RELATIONS,
  BOSSES,
  BREEDING_PROGRAMS,
  BUFFS,
  CREATURES,
  MECHANICS,
  PATCH_HISTORY,
  RESEARCH_CAMPAIGNS,
  SOURCE_REGISTRY,
} from "@/lib/ark";
import { AGENTS } from "@/lib/agents/registry";
import { generateHypotheses } from "@/lib/engines/hypothesis";

export const DEFAULT_SETTINGS = {
  gameVersion: "ARK: Survival Evolved (live build — record exact version per experiment)",
  defaultMap: "The Island",
  defaultMode: "single-player (official-equivalent defaults)",
  serverSettings: "official defaults, no multipliers",
  autonomy: {
    autoRun: true,
    maxTasksPerCycle: 12,
    maxHypothesesPerCycle: 400,
    minPriority: 20,
  },
  ai: {
    provider: "local-heuristic" as const,
    baseUrl: null,
    model: null,
    apiKeyEnv: "ARK_OMNI_AI_KEY",
  },
  logging: { level: "info" as const },
};

function sourceRegistryFromKeys(): {
  key: string;
  title: string;
  publisher: string;
  sourceType: string;
  url: string | null;
  versionTag: string;
  reliability: number;
  retrievedAt: string;
  notes: string;
}[] {
  const used = new Set<string>();
  for (const c of CREATURES) for (const s of c.sources) used.add(s);
  for (const b of BUFFS) for (const s of b.sources) used.add(s);
  for (const m of MECHANICS) for (const s of m.sourceKeys) used.add(s);
  for (const p of BREEDING_PROGRAMS) for (const s of p.sourceKeys) used.add(s);
  const extra: typeof SOURCE_REGISTRY = [];
  for (const key of used) {
    if (SOURCE_REGISTRY.some((s) => s.key === key)) continue;
    if (key.startsWith("wiki-")) {
      const name = key
        .replace("wiki-", "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
      extra.push({
        key,
        title: `ARK Wiki — ${name}`,
        publisher: "ARK Wiki / Fandom",
        sourceType: "wiki",
        url: `https://ark.fandom.com/wiki/${name.replace(/ /g, "_")}`,
        versionTag: "rolling",
        reliability: 4,
        retrievedAt: "2026-01",
        notes: "Community-maintained page. Verify values against the live page and current patch.",
      });
    } else if (key.startsWith("reddit-")) {
      extra.push({
        key,
        title: `Reddit community reports — ${key.replace("reddit-", "").replace(/-/g, " ")}`,
        publisher: "r/ARK",
        sourceType: "community",
        url: "https://www.reddit.com/r/ARK/",
        versionTag: "unspecified",
        reliability: 2,
        retrievedAt: "2026-01",
        notes: "Anecdotal. Hypothesis-grade evidence only.",
      });
    } else if (key.startsWith("patch-")) {
      extra.push({
        key,
        title: `Studio Wildcard patch notes — ${key.replace("patch-", "").replace(/-/g, " ").toUpperCase()}`,
        publisher: "Studio Wildcard",
        sourceType: "patch-notes",
        url: "https://ark.fandom.com/wiki/Patch_Notes",
        versionTag: key.replace("patch-", ""),
        reliability: 5,
        retrievedAt: "2026-01",
        notes: "Primary source for mechanic introduction and rework.",
      });
    } else {
      extra.push({
        key,
        title: key,
        publisher: "Community",
        sourceType: "community",
        url: null,
        versionTag: "unspecified",
        reliability: 2,
        retrievedAt: "2026-01",
        notes: "Unspecified source recorded from the knowledge base.",
      });
    }
  }
  return [...SOURCE_REGISTRY, ...extra].sort((a, b) => a.key.localeCompare(b.key));
}

let seedPromise: Promise<void> | null = null;

/** Idempotent knowledge-base seed. Safe to call on every request. */
export async function seedKnowledgeBase(): Promise<void> {
  await db
    .insert(settings)
    .values({ id: 1, config: DEFAULT_SETTINGS })
    .onConflictDoNothing();

  await db
    .insert(agents)
    .values(
      AGENTS.map((a) => ({
        code: a.code,
        name: a.name,
        role: a.role,
        domain: a.domain,
        mandate: a.mandate,
        methods: a.methods,
        status: "initialised",
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(creatures)
    .values(
      CREATURES.map((c) => ({
        slug: c.slug,
        name: c.name,
        species: c.species,
        diet: c.diet,
        temperament: c.temperament,
        tier: c.tier,
        rideable: c.rideable,
        saddle: c.saddle ?? null,
        saddleArmor: c.saddleArmor ?? null,
        baseHp: c.baseHp,
        baseMelee: c.baseMelee,
        baseWeight: c.baseWeight,
        baseSpeed: c.baseSpeed,
        profile: c.profile,
        roles: c.roles,
        tags: c.tags,
        maps: c.maps,
        weightReductions: c.weightReductions ?? [],
        notes: c.notes,
        underrated: Boolean(c.underrated),
        confidence: c.confidence,
        sourceKeys: c.sources,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(buffs)
    .values(
      BUFFS.map((b) => ({
        slug: b.slug,
        name: b.name,
        kind: b.kind,
        category: b.category,
        scope: b.scope,
        sourceType: b.sourceType,
        sourceSlug: b.sourceSlug ?? null,
        effects: b.effects,
        stacking: b.stacking,
        exclusiveWith: b.exclusiveWith ?? [],
        durationSec: b.durationSec ?? null,
        notes: b.notes,
        confidence: b.confidence,
        sourceKeys: b.sources,
      })),
    )
    .onConflictDoNothing();

  const abilityRows = CREATURES.flatMap((c) =>
    c.abilities.map((a) => ({
      creatureSlug: c.slug,
      name: a.name,
      kind: a.kind,
      slot: a.kind,
      description: a.description,
      grantsBuffs: a.grants ?? [],
      tags: a.tags ?? [],
      documented: a.documented ?? true,
      confidence: a.confidence ?? "documented",
    })),
  );
  await db.insert(abilities).values(abilityRows).onConflictDoNothing();

  await db
    .insert(creatureBuffs)
    .values(ALL_BUFF_RELATIONS.map((r) => ({ creatureSlug: r.creatureSlug, buffSlug: r.buffSlug, relation: r.relation })))
    .onConflictDoNothing();

  await db
    .insert(sources)
    .values(sourceRegistryFromKeys())
    .onConflictDoNothing();

  await db
    .insert(mechanics)
    .values(
      MECHANICS.map((m) => ({
        slug: m.slug,
        title: m.title,
        category: m.category,
        description: m.description,
        documentedBehaviour: m.documentedBehaviour,
        observedBehaviour: m.observedBehaviour,
        status: m.status,
        tags: m.tags,
        sourceKeys: m.sourceKeys,
        confidence: m.confidence,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(breedingPrograms)
    .values(
      BREEDING_PROGRAMS.map((p) => ({
        slug: p.slug,
        species: p.species,
        role: p.role,
        statPriorities: p.statPriorities,
        mutationStrategy: p.mutationStrategy,
        imprintingNotes: p.imprintingNotes,
        generations: p.generations,
        notes: p.notes,
        confidence: p.confidence,
        sourceKeys: p.sourceKeys,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(bosses)
    .values(
      BOSSES.map((b) => ({
        slug: b.slug,
        name: b.name,
        arena: b.arena,
        difficulty: b.difficulty,
        restrictions: b.restrictions,
        counters: b.counters,
        recommendedSlugs: b.recommendedSlugs,
        notes: b.notes,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(patchHistory)
    .values(PATCH_HISTORY)
    .onConflictDoNothing();

  await db
    .insert(campaigns)
    .values(
      RESEARCH_CAMPAIGNS.map((c) => ({
        code: c.code,
        title: c.title,
        objective: c.objective,
        domain: c.domain,
        priority: c.priority,
        status: "active",
      })),
    )
    .onConflictDoNothing();
}

/**
 * Runs the seed exactly once per process, and bootstraps the first research
 * campaign (hypotheses, agent runs, experiments, reports) if the research
 * tables are empty.
 */
export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      await seedKnowledgeBase();
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(researchTasks);
      if (Number(count) === 0) {
        const { runResearchCycle } = await import("@/lib/research/orchestrator");
        await runResearchCycle({ initial: true });
      }
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

export const HYPOTHESIS_LIMIT = 400;
export const hypothesisCatalog = generateHypotheses;
