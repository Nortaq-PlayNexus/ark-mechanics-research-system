/**
 * ARK OMNISCIENCE — Research Database Schema (PostgreSQL / Drizzle ORM)
 *
 * Every discovery in the platform is traceable to evidence: creatures -> abilities ->
 * buffs -> combinations -> hypotheses -> experiments -> discoveries -> sources.
 *
 * Migration path: the schema was designed entity-first so it can be ported to
 * SQLite (desktop build) without reshaping relationships.
 */
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ agents */

export const agents = pgTable(
  "agents",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    domain: text("domain").notNull(),
    mandate: text("mandate").notNull(),
    methods: jsonb("methods").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("idle"),
    findingsCount: integer("findings_count").notNull().default(0),
    tasksCompleted: integer("tasks_completed").notNull().default(0),
    tasksFailed: integer("tasks_failed").notNull().default(0),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agents_code_idx").on(t.code)],
);

export const agentLogs = pgTable(
  "agent_logs",
  {
    id: serial("id").primaryKey(),
    agentCode: text("agent_code").notNull(),
    level: text("level").notNull().default("info"),
    message: text("message").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_logs_agent_idx").on(t.agentCode)],
);

/* --------------------------------------------------------------- creatures */

export const creatures = pgTable(
  "creatures",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    species: text("species").notNull(),
    diet: text("diet").notNull(),
    temperament: text("temperament").notNull(),
    tier: text("tier").notNull(),
    rideable: boolean("rideable").notNull().default(false),
    saddle: text("saddle"),
    saddleArmor: integer("saddle_armor"),
    baseHp: integer("base_hp").notNull().default(0),
    baseMelee: integer("base_melee").notNull().default(0),
    baseWeight: integer("base_weight").notNull().default(0),
    baseSpeed: doublePrecision("base_speed").notNull().default(0),
    /** normalised 0-100 combat profile used by the synergy engine */
    profile: jsonb("profile")
      .$type<{
        damage: number;
        mitigation: number;
        healing: number;
        cc: number;
        mobility: number;
        weight: number;
        utility: number;
        siege: number;
      }>()
      .notNull(),
    roles: jsonb("roles").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    maps: jsonb("maps").$type<string[]>().notNull().default([]),
    weightReductions: jsonb("weight_reductions")
      .$type<{ resource: string; pct: number }[]>()
      .notNull()
      .default([]),
    /** hidden / poorly documented behaviour worth investigating */
    notes: text("notes").notNull().default(""),
    underrated: boolean("underrated").notNull().default(false),
    confidence: text("confidence").notNull().default("documented"),
    sourceKeys: jsonb("source_keys").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("creatures_slug_idx").on(t.slug)],
);

export const abilities = pgTable(
  "abilities",
  {
    id: serial("id").primaryKey(),
    creatureSlug: text("creature_slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    slot: text("slot").notNull().default("primary"),
    description: text("description").notNull(),
    grantsBuffs: jsonb("grants_buffs").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    documented: boolean("documented").notNull().default(true),
    confidence: text("confidence").notNull().default("documented"),
  },
  (t) => [index("abilities_creature_idx").on(t.creatureSlug)],
);

export const buffs = pgTable(
  "buffs",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(), // buff | debuff | status | passive
    category: text("category").notNull(),
    scope: text("scope").notNull(),
    sourceType: text("source_type").notNull(),
    sourceSlug: text("source_slug"),
    effects: jsonb("effects")
      .$type<
        {
          stat: string;
          mode: "multiplicative" | "additive" | "override" | "unknown";
          value: number | null;
          unit?: string;
        }[]
      >()
      .notNull()
      .default([]),
    stacking: text("stacking").notNull().default("does-not-stack"),
    exclusiveWith: jsonb("exclusive_with").$type<string[]>().notNull().default([]),
    durationSec: integer("duration_sec"),
    notes: text("notes").notNull().default(""),
    confidence: text("confidence").notNull().default("documented"),
    sourceKeys: jsonb("source_keys").$type<string[]>().notNull().default([]),
  },
  (t) => [uniqueIndex("buffs_slug_idx").on(t.slug)],
);

/** creature <-> buff link: grants | affected-by | immune | counters */
export const creatureBuffs = pgTable(
  "creature_buff_link",
  {
    id: serial("id").primaryKey(),
    creatureSlug: text("creature_slug").notNull(),
    buffSlug: text("buff_slug").notNull(),
    relation: text("relation").notNull(),
  },
  (t) => [
    uniqueIndex("creature_buff_link_idx").on(t.creatureSlug, t.buffSlug, t.relation),
    index("creature_buff_link_buff_idx").on(t.buffSlug),
  ],
);

/* ------------------------------------------------------------ combinations */

export const combinations = pgTable(
  "combinations",
  {
    id: serial("id").primaryKey(),
    hash: text("hash").notNull(),
    memberSlugs: jsonb("member_slugs").$type<string[]>().notNull(),
    size: integer("size").notNull(),
    context: text("context").notNull(),
    analysis: jsonb("analysis").$type<Record<string, unknown>>().notNull(),
    synergyScore: doublePrecision("synergy_score").notNull().default(0),
    synergyDelta: doublePrecision("synergy_delta").notNull().default(0),
    classification: text("classification").notNull().default("UNVERIFIED"),
    rationale: text("rationale").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("combinations_hash_idx").on(t.hash)],
);

/* -------------------------------------------------------------- hypotheses */

export const hypotheses = pgTable(
  "hypotheses",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    question: text("question").notNull(),
    statement: text("statement").notNull(),
    rationale: text("rationale").notNull().default(""),
    domain: text("domain").notNull(),
    targetSlugs: jsonb("target_slugs").$type<string[]>().notNull().default([]),
    buffSlugs: jsonb("buff_slugs").$type<string[]>().notNull().default([]),
    impact: integer("impact").notNull().default(0),
    novelty: integer("novelty").notNull().default(0),
    evidence: integer("evidence").notNull().default(0),
    feasibility: integer("feasibility").notNull().default(0),
    confidence: integer("confidence").notNull().default(0),
    priority: doublePrecision("priority").notNull().default(0),
    status: text("status").notNull().default("open"),
    proposedBy: text("proposed_by").notNull().default("AGENT-12"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("hypotheses_code_idx").on(t.code)],
);

/* -------------------------------------------------------------- experiments */

export type ExperimentConditions = {
  gameVersion: string;
  map: string;
  gameMode: string;
  serverSettings: string;
  equipment: string;
  creatureLevels: string;
  creatureStats: string;
};

export const experiments = pgTable(
  "experiments",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    hypothesisCode: text("hypothesis_code"),
    title: text("title").notNull(),
    question: text("question").notNull(),
    /** literature-derived | simulation-only | pending-manual-testing | in-progress | recorded */
    status: text("status").notNull().default("pending-manual-testing"),
    conditions: jsonb("conditions").$type<ExperimentConditions>().notNull(),
    procedure: jsonb("procedure").$type<string[]>().notNull().default([]),
    baseline: jsonb("baseline").$type<Record<string, number | null> | null>(),
    measurements: jsonb("measurements").$type<Record<string, number | null> | null>(),
    evidence: jsonb("evidence")
      .$type<{ kind: string; uri: string; note: string }[]>()
      .notNull()
      .default([]),
    results: text("results").notNull().default(""),
    limitations: text("limitations").notNull().default(""),
    confidence: integer("confidence").notNull().default(0),
    classification: text("classification").notNull().default("UNVERIFIED"),
    replicates: integer("replicates").notNull().default(0),
    assignedAgent: text("assigned_agent").notNull().default("AGENT-10"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("experiments_code_idx").on(t.code)],
);

/* -------------------------------------------------------------- discoveries */

export const discoveries = pgTable(
  "discoveries",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    domain: text("domain").notNull(),
    classification: text("classification").notNull().default("UNVERIFIED"),
    confidenceScore: integer("confidence_score").notNull().default(0),
    evidenceQuality: text("evidence_quality").notNull().default("none"),
    surprising: boolean("surprising").notNull().default(false),
    creatureSlugs: jsonb("creature_slugs").$type<string[]>().notNull().default([]),
    buffSlugs: jsonb("buff_slugs").$type<string[]>().notNull().default([]),
    hypothesisCode: text("hypothesis_code"),
    experimentCode: text("experiment_code"),
    sourceKeys: jsonb("source_keys").$type<string[]>().notNull().default([]),
    foundBy: text("found_by").notNull().default("AGENT-12"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("discoveries_code_idx").on(t.code)],
);

/* ------------------------------------------------------------------ sources */

export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    title: text("title").notNull(),
    publisher: text("publisher").notNull(),
    sourceType: text("source_type").notNull(),
    url: text("url"),
    versionTag: text("version_tag").notNull().default("unspecified"),
    reliability: integer("reliability").notNull().default(3),
    retrievedAt: text("retrieved_at").notNull(),
    notes: text("notes").notNull().default(""),
  },
  (t) => [uniqueIndex("sources_key_idx").on(t.key)],
);

export const citations = pgTable(
  "citations",
  {
    id: serial("id").primaryKey(),
    discoveryCode: text("discovery_code").notNull(),
    sourceKey: text("source_key").notNull(),
    claim: text("claim").notNull(),
  },
  (t) => [index("citations_discovery_idx").on(t.discoveryCode)],
);

/* ---------------------------------------------------------------- campaigns */

export const campaigns = pgTable(
  "campaigns",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    objective: text("objective").notNull(),
    domain: text("domain").notNull(),
    priority: integer("priority").notNull().default(3),
    status: text("status").notNull().default("active"),
    hypothesisCodes: jsonb("hypothesis_codes").$type<string[]>().notNull().default([]),
    experimentCodes: jsonb("experiment_codes").$type<string[]>().notNull().default([]),
    reportCode: text("report_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("campaigns_code_idx").on(t.code)],
);

/* ------------------------------------------------------------------ reports */

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    methodology: text("methodology").notNull(),
    gameVersion: text("game_version").notNull(),
    testingConditions: text("testing_conditions").notNull(),
    limitations: text("limitations").notNull(),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
    sourceKeys: jsonb("source_keys").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reports_code_idx").on(t.code)],
);

/* ------------------------------------------------------------ mechanics KB */

export const mechanics = pgTable(
  "mechanics",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    documentedBehaviour: text("documented_behaviour").notNull().default(""),
    observedBehaviour: text("observed_behaviour").notNull().default(""),
    status: text("status").notNull().default("needs-verification"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    sourceKeys: jsonb("source_keys").$type<string[]>().notNull().default([]),
    confidence: text("confidence").notNull().default("community-reported"),
  },
  (t) => [uniqueIndex("mechanics_slug_idx").on(t.slug)],
);

export const breedingPrograms = pgTable(
  "breeding_programs",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    species: text("species").notNull(),
    role: text("role").notNull(),
    statPriorities: jsonb("stat_priorities").$type<string[]>().notNull().default([]),
    mutationStrategy: text("mutation_strategy").notNull(),
    imprintingNotes: text("imprinting_notes").notNull().default(""),
    generations: integer("generations").notNull().default(0),
    notes: text("notes").notNull().default(""),
    confidence: text("confidence").notNull().default("community-reported"),
    sourceKeys: jsonb("source_keys").$type<string[]>().notNull().default([]),
  },
  (t) => [uniqueIndex("breeding_programs_slug_idx").on(t.slug)],
);

export const bosses = pgTable(
  "bosses",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    arena: text("arena").notNull(),
    difficulty: text("difficulty").notNull(),
    restrictions: jsonb("restrictions").$type<string[]>().notNull().default([]),
    counters: jsonb("counters").$type<string[]>().notNull().default([]),
    recommendedSlugs: jsonb("recommended_slugs").$type<string[]>().notNull().default([]),
    notes: text("notes").notNull().default(""),
  },
  (t) => [uniqueIndex("bosses_slug_idx").on(t.slug)],
);

export const patchHistory = pgTable(
  "patch_history",
  {
    id: serial("id").primaryKey(),
    version: text("version").notNull(),
    released: text("released").notNull(),
    title: text("title").notNull(),
    notes: text("notes").notNull(),
    impactTags: jsonb("impact_tags").$type<string[]>().notNull().default([]),
  },
  (t) => [uniqueIndex("patch_history_version_idx").on(t.version)],
);

/* ------------------------------------------------------------ research ops */

export const researchTasks = pgTable(
  "research_tasks",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    agentCode: text("agent_code").notNull(),
    title: text("title").notNull(),
    question: text("question").notNull(),
    domain: text("domain").notNull(),
    priority: doublePrecision("priority").notNull().default(3),
    status: text("status").notNull().default("queued"),
    hypothesisCode: text("hypothesis_code"),
    targetSlugs: jsonb("target_slugs").$type<string[]>().notNull().default([]),
    dedupeKey: text("dedupe_key").notNull(),
    outcome: text("outcome").notNull().default(""),
    summary: text("summary").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("research_tasks_dedupe_idx").on(t.dedupeKey),
    index("research_tasks_agent_idx").on(t.agentCode),
  ],
);

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  config: jsonb("config")
    .$type<{
      gameVersion: string;
      defaultMap: string;
      defaultMode: string;
      serverSettings: string;
      autonomy: {
        autoRun: boolean;
        maxTasksPerCycle: number;
        maxHypothesesPerCycle: number;
        minPriority: number;
      };
      ai: {
        provider: "local-heuristic" | "openai-compatible" | "ollama";
        baseUrl: string | null;
        model: string | null;
        apiKeyEnv: string | null;
      };
      logging: { level: "debug" | "info" | "warn" | "error" };
    }>()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
