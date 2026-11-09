import { writeFileSync, mkdirSync } from "node:fs";
import { CREATURES, BUFFS, KB_STATS } from "../src/lib/ark";
import { BOSSES } from "../src/lib/ark/auxiliary";
mkdirSync("desktop/ark_omniscience/data", { recursive: true });
const payload = {
  generatedAt: new Date().toISOString(),
  stats: KB_STATS,
  creatures: CREATURES.map((c) => ({
    slug: c.slug, name: c.name, species: c.species, tier: c.tier,
    profile: c.profile, roles: c.roles, notes: c.notes,
    underrated: !!c.underrated, confidence: c.confidence,
    abilities: c.abilities.map((a) => ({ name: a.name, kind: a.kind, description: a.description })),
    grants: c.grants ?? [], affectedBy: c.affectedBy ?? [], immune: c.immune ?? [], counters: c.counters ?? [],
  })),
  buffs: BUFFS.map((b) => ({
    slug: b.slug, name: b.name, kind: b.kind, category: b.category, scope: b.scope,
    stacking: b.stacking, sourceType: b.sourceType, sourceSlug: b.sourceSlug,
    effects: b.effects, notes: b.notes, confidence: b.confidence,
  })),
  bosses: BOSSES,
};
writeFileSync("desktop/ark_omniscience/data/knowledge_base.json", JSON.stringify(payload, null, 1));
console.log(`exported ${CREATURES.length} creatures, ${BUFFS.length} buffs, ${BOSSES.length} bosses`);
