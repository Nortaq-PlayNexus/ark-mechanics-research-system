import { CORE_CREATURES } from "./creatures.core";
import { EXTRA_BUFF_RELATIONS, SUPPORT_CREATURES } from "./creatures.support";
import { BUFFS } from "./buffs";
import type { ArkBuff, ArkCreature } from "./types";

export * from "./types";
export * from "./buffs";
export * from "./auxiliary";
export { CREATURE_DEFAULTS, makeCreature } from "./creatures.core";

export const CREATURES: ArkCreature[] = [...CORE_CREATURES, ...SUPPORT_CREATURES].sort((a, b) =>
  a.name.localeCompare(b.name),
);

export const CREATURE_BY_SLUG = new Map(CREATURES.map((c) => [c.slug, c]));
export const BUFF_BY_SLUG = new Map(BUFFS.map((b) => [b.slug, b]));

export const ALL_BUFF_RELATIONS: { creatureSlug: string; buffSlug: string; relation: string }[] = (() => {
  const out: { creatureSlug: string; buffSlug: string; relation: string }[] = [];
  for (const c of CREATURES) {
    for (const b of c.grants ?? []) out.push({ creatureSlug: c.slug, buffSlug: b, relation: "grants" });
    for (const b of c.affectedBy ?? []) out.push({ creatureSlug: c.slug, buffSlug: b, relation: "affected-by" });
    for (const b of c.immune ?? []) out.push({ creatureSlug: c.slug, buffSlug: b, relation: "immune" });
    for (const b of c.counters ?? []) out.push({ creatureSlug: c.slug, buffSlug: b, relation: "counters" });
  }
  const seen = new Set(out.map((r) => `${r.creatureSlug}|${r.buffSlug}|${r.relation}`));
  for (const r of EXTRA_BUFF_RELATIONS) {
    if (!CREATURE_BY_SLUG.has(r.creatureSlug)) continue;
    if (!BUFF_BY_SLUG.has(r.buffSlug)) continue;
    const key = `${r.creatureSlug}|${r.buffSlug}|${r.relation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
})();

/** Buffs referenced anywhere in the KB that are not defined in the buff table. */
export const ORPHAN_BUFF_REFERENCES: string[] = (() => {
  const defined = new Set(BUFFS.map((b) => b.slug));
  return [...new Set(ALL_BUFF_RELATIONS.map((r) => r.buffSlug))].filter((s) => !defined.has(s)).sort();
})();

/** Creature-provided buffs that an ally can receive, keyed by buff slug. */
export const BUFF_PROVIDERS = new Map<string, string[]>(
  [...new Set(ALL_BUFF_RELATIONS.filter((r) => r.relation === "grants").map((r) => r.buffSlug))].map((slug) => [
    slug,
    ALL_BUFF_RELATIONS.filter((r) => r.relation === "grants" && r.buffSlug === slug).map((r) => r.creatureSlug),
  ]),
);

export function creature(slug: string): ArkCreature | undefined {
  return CREATURE_BY_SLUG.get(slug);
}

export function buff(slug: string): ArkBuff | undefined {
  return BUFF_BY_SLUG.get(slug);
}

export const KB_STATS = {
  creatures: CREATURES.length,
  buffs: BUFFS.length,
  abilities: CREATURES.reduce((n, c) => n + c.abilities.length, 0),
  relations: ALL_BUFF_RELATIONS.length,
  underrated: CREATURES.filter((c) => c.underrated).length,
  needsVerification: [...BUFFS.filter((b) => b.confidence !== "documented"), ...CREATURES.filter((c) => c.confidence !== "documented")].length,
};
