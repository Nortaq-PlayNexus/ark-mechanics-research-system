/**
 * Smoke test: seeds the knowledge base, runs a full research cycle and prints
 * row counts so the whole pipeline can be verified from the command line.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/smoke.ts
 */
import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { ensureSeeded } from "@/lib/db/seed";
import { runResearchCycle } from "@/lib/research/orchestrator";
import { analyseCombination } from "@/lib/engines/synergy";
import { generateHypotheses } from "@/lib/engines/hypothesis";
import { importResults } from "@/lib/engines/experiment";
import { KB_STATS } from "@/lib/ark";

async function main() {
  console.log("KB stats:", KB_STATS);
  const hyps = generateHypotheses();
  console.log(`hypotheses generated: ${hyps.length}`);
  console.log("top 3:", hyps.slice(0, 3).map((h) => `${h.dedupeKey} (p=${h.priority})`));

  const sample = analyseCombination(["yutyrannus", "daeodon", "therizinosaurus", "light-pet"], "raid-assault");
  console.log(`sample combination: ${sample.members.map((m) => m.name).join(" + ")}`);
  console.log(`  party=${sample.partyScore} best=${sample.bestSingleScore} delta=${sample.synergyDelta} synergy=${sample.synergyScore}`);
  console.log(`  dmgMult=${sample.estimatedDamageMultiplier} mitigation=${sample.estimatedMitigation}`);
  console.log(`  conflicts=${sample.conflicts.map((c) => c.title).join(" | ")}`);

  await ensureSeeded();
  const cycle = await runResearchCycle({ initial: true });
  console.log("cycle result:", cycle);

  const tables = [
    "creatures",
    "abilities",
    "buffs",
    "creature_buff_link",
    "sources",
    "mechanics",
    "breeding_programs",
    "bosses",
    "patch_history",
    "campaigns",
    "agents",
    "hypotheses",
    "research_tasks",
    "discoveries",
    "experiments",
    "combinations",
    "reports",
    "agent_logs",
  ];
  for (const t of tables) {
    const res = await db.execute(sql.raw(`select count(*)::int as n from ${t}`));
    const rows = (res as unknown as { rows: { n: number }[] }).rows ?? [];
    console.log(`${t}: ${rows[0]?.n ?? "?"}`);
  }

  const validated = importResults({
    measurements: [
      { metric: "damage-per-swing", baseline: 100, experimental: 152, samples: 10 },
      { metric: "time-to-kill", baseline: 60, experimental: 41, samples: 10 },
    ],
    replicates: 3,
    notes: "Simulated operator import used only to exercise the classification code path.",
    evidence: [{ kind: "screenshot", uri: "file://evidence/example.png", note: "placeholder" }],
  });
  console.log("importResults classification:", validated.classification, "confidence", validated.confidence);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
});
