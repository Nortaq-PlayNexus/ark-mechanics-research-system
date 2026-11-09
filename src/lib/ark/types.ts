/**
 * ARK OMNISCIENCE — shared knowledge-base types.
 *
 * IMPORTANT RESEARCH INTEGRITY NOTES
 * - `confidence` marks how well supported a data point is. "documented" means it
 *   appears in official/primary documentation, "community-reported" means widely
 *   repeated by the community but not formally specified, "needs-verification"
 *   means the value is disputed or unverified.
 * - `profile` values are ARK OMNISCIENCE analyst ratings on a 0-100 scale used by
 *   the synergy engine. They are NOT in-game numbers and must never be presented
 *   as such.
 */

export type Confidence = "documented" | "community-reported" | "needs-verification";

export type AbilityKind =
  | "primary"
  | "secondary"
  | "active"
  | "passive"
  | "utility"
  | "special"
  | "saddle";

export interface ArkAbility {
  name: string;
  kind: AbilityKind;
  description: string;
  grants?: string[];
  tags?: string[];
  confidence?: Confidence;
  /** false = community claims exist but no primary documentation */
  documented?: boolean;
}

export interface CreatureProfile {
  damage: number;
  mitigation: number;
  healing: number;
  cc: number;
  mobility: number;
  weight: number;
  utility: number;
  siege: number;
}

export interface ArkCreature {
  slug: string;
  name: string;
  species: string;
  diet: string;
  temperament: string;
  tier: "shoulder" | "small" | "medium" | "large" | "titan";
  rideable: boolean;
  saddle?: string;
  saddleArmor?: number;
  baseHp: number;
  baseMelee: number;
  baseWeight: number;
  baseSpeed: number;
  /** analyst rating 0-100 (see file header) */
  profile: CreatureProfile;
  roles: string[];
  tags: string[];
  maps: string[];
  weightReductions?: { resource: string; pct: number }[];
  abilities: ArkAbility[];
  grants?: string[];
  affectedBy?: string[];
  immune?: string[];
  counters?: string[];
  notes: string;
  underrated?: boolean;
  confidence: Confidence;
  sources: string[];
}

export type BuffKind = "buff" | "debuff" | "status" | "passive" | "active";
export type BuffCategory =
  | "damage"
  | "resistance"
  | "healing"
  | "mobility"
  | "torpor"
  | "control"
  | "utility"
  | "survival"
  | "breeding"
  | "stealth"
  | "siege";

export interface BuffEffect {
  stat: string;
  mode: "multiplicative" | "additive" | "override" | "unknown";
  value: number | null;
  unit?: string;
}

export interface ArkBuff {
  slug: string;
  name: string;
  kind: BuffKind;
  category: BuffCategory;
  scope: "self" | "allies" | "aura" | "enemies" | "rider" | "area";
  sourceType: "creature" | "player" | "saddle" | "food" | "environment" | "equipment";
  sourceSlug?: string;
  effects: BuffEffect[];
  stacking: "stacks" | "does-not-stack" | "refreshes" | "unknown";
  exclusiveWith?: string[];
  durationSec?: number | null;
  notes: string;
  confidence: Confidence;
  sources: string[];
}

export const DISCOVERY_CLASSIFICATIONS = [
  "UNVERIFIED",
  "SOURCE-SUPPORTED",
  "PARTIALLY-VALIDATED",
  "EXPERIMENTALLY-CONFIRMED",
  "INDEPENDENTLY-REPLICATED",
  "PATCHED / OBSOLETE",
] as const;

export type DiscoveryClassification = (typeof DISCOVERY_CLASSIFICATIONS)[number];

export const CLASSIFICATION_ORDER: Record<DiscoveryClassification, number> = {
  UNVERIFIED: 0,
  "SOURCE-SUPPORTED": 1,
  "PARTIALLY-VALIDATED": 2,
  "EXPERIMENTALLY-CONFIRMED": 3,
  "INDEPENDENTLY-REPLICATED": 4,
  "PATCHED / OBSOLETE": -1,
};
