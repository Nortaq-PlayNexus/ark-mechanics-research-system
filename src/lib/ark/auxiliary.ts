import type { Confidence } from "./types";

export interface BossRecord {
  slug: string;
  name: string;
  arena: string;
  difficulty: string;
  restrictions: string[];
  counters: string[];
  recommendedSlugs: string[];
  notes: string;
}

export const BOSSES: BossRecord[] = [
  {
    slug: "broodmother",
    name: "Broodmother Lysrix",
    arena: "Broodmother Arena (The Island / Valguero)",
    difficulty: "Gamma / Beta / Alpha",
    restrictions: ["No flyers", "Limited creature count", "Arena spider spawns"],
    counters: ["bug-buff", "bleed", "sustain"],
    recommendedSlugs: ["megatherium", "daeodon", "yutyrannus", "deinonychus"],
    notes:
      "Insect spawns feed Megatherium's Bug Killer buff; whether boss-adjacent spiders trigger it reliably on every map is a live verification question. Bleed is armour-independent and strong against high-HP bosses.",
  },
  {
    slug: "megapithecus",
    name: "Megapithecus",
    arena: "Megapithecus Arena",
    difficulty: "Gamma / Beta / Alpha",
    restrictions: ["No flyers", "Jungle arena with minions"],
    counters: ["high-melee", "crowd-clear", "sustain"],
    recommendedSlugs: ["rex", "therizinosaurus", "daeodon", "yutyrannus"],
    notes:
      "Minion pressure favours sustain + buffed melee. Therizinosaur lines are cake-healable, which raises effective staying power relative to cost.",
  },
  {
    slug: "dragon",
    name: "Dragon",
    arena: "Dragon Arena",
    difficulty: "Gamma / Beta / Alpha",
    restrictions: ["No flyers", "Fire breath DoT"],
    counters: ["fire-resistance", "ranged-damage", "sustain"],
    recommendedSlugs: ["yutyrannus", "daeodon", "velonasaur", "allosaurus"],
    notes:
      "Fire breath is percentage-based damage over time; healing throughput matters more than raw HP. Ranged damage dealers avoid the melee clump where breath lands.",
  },
  {
    slug: "overseer",
    name: "Overseer",
    arena: "Tek Cave (The Island)",
    difficulty: "Alpha requires full tribute set",
    restrictions: ["Tek Cave entry level gate", "Temperature extremes", "No platform saddles"],
    counters: ["mixed-damage", "mobility"],
    recommendedSlugs: ["rex", "yutyrannus", "daeodon", "snow-owl"],
    notes: "Tek cave temperature stages make insulation support relevant — a rarely modelled constraint.",
  },
  {
    slug: "rockwell",
    name: "Rockwell",
    arena: "Rockwell Arena (Aberration)",
    difficulty: "Gamma / Beta / Alpha",
    restrictions: ["Radiation", "No flyers (gliders only)", "Arena tentacles"],
    counters: ["radiation-immunity", "bleed", "sustain"],
    recommendedSlugs: ["rock-drake", "reaper-king", "megatherium", "karkinos"],
    notes:
      "Radiation gates the entire composition: only radiation-immune mounts can stay in the arena. Charge light from light pets strips Reaper damage reduction inside this fight.",
  },
  {
    slug: "king-titan",
    name: "King Titan",
    arena: "King Titan Arena (Extinction)",
    difficulty: "Alpha requires titans",
    restrictions: ["Titan-class entry", "Corrupted minion waves", "Orbital supply drops"],
    counters: ["titan-scale-damage", "siege", "sustain"],
    recommendedSlugs: ["mek", "giganotosaurus", "yutyrannus", "daeodon"],
    notes: "Mek siege modules and buffed Giga lines are the documented approach; the interaction of Mek shields with creature auras is undocumented.",
  },
  {
    slug: "desert-titan",
    name: "Desert Titan",
    arena: "Desert Titan (Extinction)",
    difficulty: "Titan",
    restrictions: ["Flying boss", "Lightning strikes", "Flock minions"],
    counters: ["anti-air", "ranged-damage"],
    recommendedSlugs: ["velonasaur", "managarmr", "wyvern-lightning", "snow-owl"],
    notes: "Flying boss makes ground-only melee compositions useless — the most common raid-planning error.",
  },
  {
    slug: "master-controller",
    name: "Master Controller (Corrupted Master Controller)",
    arena: "Genesis Ship Simulations",
    difficulty: "Alpha",
    restrictions: ["Simulation-only creature limits", "Corrupted waves"],
    counters: ["sustain", "mixed-damage"],
    recommendedSlugs: ["shadowmane", "astrodelphis", "megatherium", "daeodon"],
    notes: "Shadowmane and Astrodelphis dominate here; both have ability interactions that are not fully documented.",
  },
];

export interface MechanicRecord {
  slug: string;
  title: string;
  category: string;
  description: string;
  documentedBehaviour: string;
  observedBehaviour: string;
  status: string;
  tags: string[];
  sourceKeys: string[];
  confidence: Confidence;
}

/** Seeds for the Undiscovered Mechanics division — every entry is an open question, not a claim. */
export const MECHANICS: MechanicRecord[] = [
  {
    slug: "aura-stacking-cap",
    title: "Do multiple ally auras of the same type stack?",
    category: "buff-interaction",
    description:
      "Two Daeodons, two Yutyrannus, or two Mammoth war drums in the same party: does the effect stack, refresh, or hard-overwrite?",
    documentedBehaviour: "Official documentation does not specify stacking for most auras.",
    observedBehaviour: "Community consensus says 'refresh, not stack' for Yuty courage; Daeodon is widely disputed.",
    status: "needs-verification",
    tags: ["aura", "stacking", "healing", "damage"],
    sourceKeys: ["wiki-daodon", "reddit-daodon-stacking", "wiki-yuty"],
    confidence: "needs-verification",
  },
  {
    slug: "multiplicative-vs-additive-resistance",
    title: "Are resistance buffs multiplicative or additive?",
    category: "buff-interaction",
    description:
      "Yuty Courage Roar + Mammoth War Drums + Shadow Steak Saute + saddle armour: is the total reduction combined multiplicatively, additively, or is the largest taken?",
    documentedBehaviour: "No primary source states the combination rule.",
    observedBehaviour: "Players routinely assume additive stacking, which can exceed 100% reduction and is obviously wrong.",
    status: "needs-verification",
    tags: ["resistance", "stacking", "math"],
    sourceKeys: ["wiki-yuty", "wiki-mammoth", "reddit-shadow-steak"],
    confidence: "needs-verification",
  },
  {
    slug: "bleed-refresh-behaviour",
    title: "Do bleed sources from different creatures stack?",
    category: "combat",
    description:
      "Allosaurus Gnash, Deinonychus rake and Thylacoleo pounce bleed applied to the same target: independent stacks or shared debuff slot?",
    documentedBehaviour: "Gnash is documented as a single debuff with 5s duration.",
    observedBehaviour: "Mixed reports on whether a second creature's bleed refreshes, overrides or stacks.",
    status: "needs-verification",
    tags: ["bleed", "armour-pierce", "stacking"],
    sourceKeys: ["wiki-allosaurus", "wiki-deinonychus", "wiki-status-effects"],
    confidence: "needs-verification",
  },
  {
    slug: "fear-roar-friendly-fire",
    title: "Does Yuty Fear Roar rout your own tames?",
    category: "creature-behaviour",
    description:
      "Fear Roar's level threshold is applied to creatures in radius regardless of ownership in many versions — verify per version and per game mode.",
    documentedBehaviour: "Fear Roar scares creatures below a level threshold.",
    observedBehaviour: "Multiple reports of friendly low-level tames and shoulder pets being routed.",
    status: "partially-verified",
    tags: ["roar", "friendly-fire", "pvp"],
    sourceKeys: ["wiki-yuty", "forum-reports"],
    confidence: "community-reported",
  },
  {
    slug: "charge-light-inversion",
    title: "Charge light: buff or debuff?",
    category: "environment-interaction",
    description:
      "Charge light simultaneously suppresses Nameless, strips Reaper damage reduction and *empowers* Seekers. One aura, three opposite outcomes.",
    documentedBehaviour: "Each individual interaction is documented separately.",
    observedBehaviour: "Players usually only know the Nameless half and bring light pets into Seeker territory.",
    status: "documented",
    tags: ["charge-light", "aberration", "inverted-interaction"],
    sourceKeys: ["wiki-light-pets", "wiki-reaper", "wiki-seeker"],
    confidence: "documented",
  },
  {
    slug: "armour-bypass-damage",
    title: "Which damage sources ignore armour entirely?",
    category: "combat",
    description:
      "Gnash bleed, Arthropluera acid, Poison Wyvern clouds and fall damage reportedly ignore saddle/armour reduction. Quantifying which bypass armour changes every PvP calculation.",
    documentedBehaviour: "Percentage bleed ignores armour; acid damages armour durability.",
    observedBehaviour: "Poison Wyvern clouds are widely reported to hit the rider directly.",
    status: "partially-verified",
    tags: ["armour", "pierce", "pvp", "math"],
    sourceKeys: ["wiki-status-effects", "wiki-arthropluera", "reddit-poison-wyvern"],
    confidence: "community-reported",
  },
  {
    slug: "cake-healing-herbivore-lines",
    title: "Sweet Vegetable Cake as a raid sustain item",
    category: "combat",
    description:
      "Cake heals herbivores only. Entire front lines built from herbivores (Trike, Stego, Theri, Paracer, Mammoth) become self-sustaining without a Daeodon's food drain.",
    documentedBehaviour: "Cake heals herbivores.",
    observedBehaviour: "Rarely used in war compositions despite being craftable in bulk.",
    status: "source-supported",
    tags: ["healing", "herbivore", "raiding", "underrated"],
    sourceKeys: ["wiki-consumables", "wiki-therizinosaurus"],
    confidence: "documented",
  },
  {
    slug: "dismount-immunity-stacking",
    title: "Which mounts prevent rider dismount?",
    category: "creature-behaviour",
    description:
      "Several creatures/stances are reported to resist dismount effects (Microraptor leaps, whip, Kapro grabs). Establishing which combinations protect the rider defines the anti-cavalry meta.",
    documentedBehaviour: "Dismount effects exist and are widely used.",
    observedBehaviour: "Reports differ on which mounts are immune, and it appears version dependent.",
    status: "needs-verification",
    tags: ["dismount", "pvp", "rider-protection"],
    sourceKeys: ["wiki-microraptor", "wiki-mantis", "wiki-stego"],
    confidence: "needs-verification",
  },
  {
    slug: "official-vs-singleplayer",
    title: "Official vs unofficial vs single-player mechanic drift",
    category: "mode-differences",
    description:
      "Buff tick rates, wild dino level caps, cryopod cooldowns, turret damage multipliers and structure resistance all differ with server settings, which invalidates cross-source comparisons.",
    documentedBehaviour: "Server settings are documented as altering many of these values.",
    observedBehaviour: "Community guides routinely quote numbers measured on boosted servers as if they were defaults.",
    status: "needs-verification",
    tags: ["server-settings", "methodology", "confound"],
    sourceKeys: ["wiki-server-settings", "patch-notes-archive"],
    confidence: "community-reported",
  },
  {
    slug: "map-specific-spawn-gating",
    title: "Map availability changes composition viability",
    category: "map-differences",
    description:
      "Desmodus, Rock Drake, Managarmr, Astrodelphis, Noglin and Maewing exist only on some maps. A composition that dominates one map is impossible on another.",
    documentedBehaviour: "Spawn tables are published per map.",
    observedBehaviour: "Guides frequently recommend map-specific creatures as if universally available.",
    status: "documented",
    tags: ["maps", "availability", "planning"],
    sourceKeys: ["wiki-spawn-maps", "wiki-desmodus"],
    confidence: "documented",
  },
  {
    slug: "food-mana-economy-of-auras",
    title: "Food economy of sustain auras",
    category: "combat",
    description:
      "Daeodon healing drains food; whether food drain scales with the number of healed targets determines how many creatures one Daeodon can support.",
    documentedBehaviour: "Healing consumes food.",
    observedBehaviour: "No published formula for target-count scaling.",
    status: "needs-verification",
    tags: ["healing", "economy", "math"],
    sourceKeys: ["wiki-daodon", "reddit-daodon-stacking"],
    confidence: "community-reported",
  },
  {
    slug: "turret-soak-damage-type",
    title: "Turret damage typing vs soak platforms",
    category: "raiding",
    description:
      "Autoturrets fire projectiles, which Rock Elementals essentially ignore while Doedicurus curl reportedly caps per-hit damage. The soak value of a platform depends entirely on the defence's damage typing.",
    documentedBehaviour: "Rock Elemental ranged immunity is documented.",
    observedBehaviour: "Doedicurus curl per-hit cap is widely reported but unmeasured.",
    status: "partially-verified",
    tags: ["raiding", "soak", "turrets", "mitigation"],
    sourceKeys: ["wiki-rock-elemental", "reddit-doed"],
    confidence: "community-reported",
  },
];

export interface BreedingRecord {
  slug: string;
  species: string;
  role: string;
  statPriorities: string[];
  mutationStrategy: string;
  imprintingNotes: string;
  generations: number;
  notes: string;
  confidence: Confidence;
  sourceKeys: string[];
}

export const BREEDING_PROGRAMS: BreedingRecord[] = [
  {
    slug: "rex-boss-line",
    species: "rex",
    role: "Boss front-line damage",
    statPriorities: ["health", "melee"],
    mutationStrategy:
      "Separate clean stat lines then combine; run melee and health mutations on separate parents so each stays under the 20-mutation-per-stat guardrail.",
    imprintingNotes: "Full imprint on the final generation before a boss attempt; imprint bonus applies to both stats and rider damage.",
    generations: 8,
    notes:
      "Standard boss benchmark. Real gains come from imprint and Yuty roar multiplication rather than further raw melee mutations.",
    confidence: "documented",
    sourceKeys: ["wiki-mating", "wiki-rex"],
  },
  {
    slug: "deinonychus-bleed-line",
    species: "deinonychus",
    role: "Armour-independent PvP damage",
    statPriorities: ["melee", "health", "stamina"],
    mutationStrategy:
      "Focus melee because rake bleed scales with it; keep the line small since bleed output is per-creature and cheap to mass.",
    imprintingNotes: "Imprint raises survivability more than damage; prior health on cheap lines used as expendable flankers.",
    generations: 5,
    notes:
      "Highest damage-per-breeding-hour against armoured targets if bleed stacking works as reported — needs the bleed-stacking experiment first.",
    confidence: "community-reported",
    sourceKeys: ["wiki-deinonychus", "wiki-status-effects"],
  },
  {
    slug: "theri-cake-line",
    species: "therizinosaurus",
    role: "Self-sustaining herbivore front line",
    statPriorities: ["health", "melee"],
    mutationStrategy: "Health-first: the line is healed by cakes, so effective HP compounds with healing throughput.",
    imprintingNotes: "Imprint both health and melee; cake healing is a flat rate so the value of each HP point is preserved.",
    generations: 6,
    notes: "Trade: no Daeodon food drain during a push, and cakes are stockpilable in advance.",
    confidence: "documented",
    sourceKeys: ["wiki-therizinosaurus", "wiki-consumables"],
  },
  {
    slug: "shadowmane-generalist",
    species: "shadowmane",
    role: "Multi-role PvP core",
    statPriorities: ["health", "melee", "stamina"],
    mutationStrategy: "Balanced line; Shadowmane utility scales with survival more than with raw melee.",
    imprintingNotes: "Imprint matters less than for Rex lines because engagements are short and ability-driven.",
    generations: 5,
    notes: "Utility-first creature: breeding investment goes into staying alive long enough to use warp-stun twice.",
    confidence: "community-reported",
    sourceKeys: ["wiki-shadowmane"],
  },
  {
    slug: "velonasaur-turret-line",
    species: "velonasaur",
    role: "Base defence / boss ranged damage",
    statPriorities: ["melee", "health", "food"],
    mutationStrategy:
      "Melee drives turret-mode damage; food extends sustained fire windows, which is frequently overlooked.",
    imprintingNotes: "Imprint for damage; defence lines are usually parked so stamina is irrelevant.",
    generations: 6,
    notes: "Turret mode converts a breeding line into free, unpowered base defence that cannot be drained like a generator.",
    confidence: "documented",
    sourceKeys: ["wiki-velonasaur"],
  },
  {
    slug: "rock-drake-stealth-line",
    species: "rock-drake",
    role: "Radiation-zone infiltration",
    statPriorities: ["health", "stamina", "weight"],
    mutationStrategy: "Survival and carry weight over melee; the role is delivery, not damage.",
    imprintingNotes: "Imprint stamina and weight for long glides with a full cargo.",
    generations: 5,
    notes: "Radiation immunity cannot be bred in — the value here is logistics, not damage.",
    confidence: "documented",
    sourceKeys: ["wiki-rock-drake"],
  },
  {
    slug: "giga-rage-management",
    species: "giganotosaurus",
    role: "Structure breaking",
    statPriorities: ["melee", "health"],
    mutationStrategy: "Melee-heavy but capped by practicality: a Giga that rages mid-raid is a liability, so health is the real safety stat.",
    imprintingNotes: "Imprint raises rider damage bonus, which is the main reason to imprint rather than just mutate.",
    generations: 6,
    notes: "Rage management, not stat maximisation, is the binding constraint on Giga value.",
    confidence: "documented",
    sourceKeys: ["wiki-giga"],
  },
  {
    slug: "maewing-logistics-line",
    species: "maewing",
    role: "Nursery and logistics (strategic multiplier)",
    statPriorities: ["weight", "stamina", "health"],
    mutationStrategy: "Utility stats only; melee is irrelevant to the role.",
    imprintingNotes: "Imprint weight; a faster, heavier Maewing shortens every breeding cycle in the tribe.",
    generations: 4,
    notes:
      "The highest-leverage breeding programme in the platform's model: nursery throughput limits every other line.",
    confidence: "community-reported",
    sourceKeys: ["wiki-maewing"],
  },
];

export interface PatchRecord {
  version: string;
  released: string;
  title: string;
  notes: string;
  impactTags: string[];
}

export const PATCH_HISTORY: PatchRecord[] = [
  {
    version: "TLC Phase 2",
    released: "2018-03",
    title: "Raptor pack, Parasaur scan, Trike rivalry",
    notes: "Added pack buffs for Raptors, threat scan for Parasaurs and the Rivalry mechanic for Triceratops.",
    impactTags: ["buff", "pack", "detection"],
  },
  {
    version: "TLC Phase 3",
    released: "2018-10",
    title: "Mammoth war drums, Stego plate modes, Yuty roar rework",
    notes: "Reworked several herbivores and formalised Yutyrannus roar buffs; introduced Stegosaurus plate modes.",
    impactTags: ["buff", "aura", "resistance"],
  },
  {
    version: "Aberration",
    released: "2017-12",
    title: "Charge light, Nameless, Reaper, Rock Drake",
    notes: "Introduced the charge-light interaction triangle that underpins most Aberration composition decisions.",
    impactTags: ["charge-light", "radiation", "new-creatures"],
  },
  {
    version: "Extinction",
    released: "2018-11",
    title: "Meks, Enforcers, Titans, Velonasaurs",
    notes: "Introduced module-based siege and anti-Reaper creature interactions.",
    impactTags: ["siege", "titan", "module"],
  },
  {
    version: "Genesis Part 2",
    released: "2021-06",
    title: "Shadowmane, Astrodelphis, Noglin, Maewing, Stryder",
    notes: "Added the highest-utility creature set in the game; several of these have undocumented interactions.",
    impactTags: ["utility", "stealth", "control"],
  },
  {
    version: "Late-life additions",
    released: "2022-2023",
    title: "Carcharodontosaurus, Rhyniognatha, Desmodus",
    notes:
      "Late additions whose mechanics were community-documented first; treat their numbers as lower confidence than the rest of the KB.",
    impactTags: ["new-creatures", "confidence-warning"],
  },
];

/** Source registry is generated from the citation keys used across the KB. */
export const SOURCE_REGISTRY: {
  key: string;
  title: string;
  publisher: string;
  sourceType: string;
  url: string | null;
  versionTag: string;
  reliability: number;
  retrievedAt: string;
  notes: string;
}[] = [
  {
    key: "wiki-root",
    title: "ARK Official Wiki (community-maintained)",
    publisher: "ARK Wiki / Fandom",
    sourceType: "wiki",
    url: "https://ark.fandom.com/wiki/ARK_Survival_Evolved_Wiki",
    versionTag: "rolling",
    reliability: 4,
    retrievedAt: "2026-01",
    notes: "Primary reference for the KB. Community-edited, so values drift with patches.",
  },
  {
    key: "patch-notes-archive",
    title: "ARK: Survival Evolved patch notes archive",
    publisher: "Studio Wildcard",
    sourceType: "patch-notes",
    url: "https://ark.fandom.com/wiki/Patch_Notes",
    versionTag: "rolling",
    reliability: 5,
    retrievedAt: "2026-01",
    notes: "Highest-reliability source for mechanic changes and TLC content.",
  },
  {
    key: "wiki-server-settings",
    title: "Server configuration documentation",
    publisher: "ARK Wiki / Fandom",
    sourceType: "official-docs",
    url: "https://ark.fandom.com/wiki/Server_Configuration",
    versionTag: "rolling",
    reliability: 4,
    retrievedAt: "2026-01",
    notes: "Defines which numbers are server-dependent and therefore non-comparable between sources.",
  },
  {
    key: "wiki-spawn-maps",
    title: "Creature spawn maps",
    publisher: "ARK Wiki / Fandom",
    sourceType: "wiki",
    url: "https://ark.fandom.com/wiki/Creature_IDs",
    versionTag: "rolling",
    reliability: 4,
    retrievedAt: "2026-01",
    notes: "Used for map availability gating of compositions.",
  },
  {
    key: "reddit-ark",
    title: "r/ARK community reports",
    publisher: "Reddit",
    sourceType: "community",
    url: "https://www.reddit.com/r/ARK/",
    versionTag: "unspecified",
    reliability: 2,
    retrievedAt: "2026-01",
    notes: "Anecdotal evidence. Useful for hypothesis generation, never sufficient for confirmation.",
  },
  {
    key: "forum-reports",
    title: "Community forum reports (Steam / official forums)",
    publisher: "Valve / Studio Wildcard forums",
    sourceType: "community",
    url: "https://steamcommunity.com/app/346110/discussions/",
    versionTag: "unspecified",
    reliability: 2,
    retrievedAt: "2026-01",
    notes: "Anecdotal evidence with heavy version drift.",
  },
];

export const RESEARCH_CAMPAIGNS: {
  code: string;
  title: string;
  objective: string;
  domain: string;
  priority: number;
}[] = [
  {
    code: "CAMPAIGN-01",
    title: "Buff Interaction & Stacking Matrix",
    objective:
      "Establish, for every pair of ally-facing buffs, whether they stack, refresh or conflict — and whether the combination rule is multiplicative or additive.",
    domain: "buff-interaction",
    priority: 1,
  },
  {
    code: "CAMPAIGN-02",
    title: "Overlooked Raid-Support Combinations",
    objective:
      "Find support creatures whose buffs, de-aggro effects or logistics value are absent from conventional raid compositions.",
    domain: "raid-intelligence",
    priority: 2,
  },
  {
    code: "CAMPAIGN-03",
    title: "Defensive Creature Formations",
    objective:
      "Identify formations that maximise soak, healing throughput and rider protection per tame slot for base defence.",
    domain: "defence",
    priority: 2,
  },
  {
    code: "CAMPAIGN-04",
    title: "Armour-Independent Damage Sources",
    objective:
      "Quantify which damage sources ignore saddle armour and therefore beat mutated, ascendant-saddled PvP tanks.",
    domain: "pvp-meta",
    priority: 1,
  },
  {
    code: "CAMPAIGN-05",
    title: "Unexpected Creature Ability Interactions",
    objective:
      "Surface pairs of abilities that change each other's behaviour (charge light, fear roar friendly fire, grab + dismount immunity).",
    domain: "mechanics",
    priority: 2,
  },
  {
    code: "CAMPAIGN-06",
    title: "Underrated Creature Re-evaluation",
    objective:
      "Re-score every creature with combination potential in mind rather than solo stats, and rank the resulting surprises.",
    domain: "creature-intelligence",
    priority: 3,
  },
  {
    code: "CAMPAIGN-07",
    title: "Breeding For Specialised Combat Roles",
    objective:
      "Map stat priorities and mutation strategies to roles, including utility creatures whose value multiplies other lines.",
    domain: "breeding",
    priority: 3,
  },
  {
    code: "CAMPAIGN-08",
    title: "Official vs Unofficial vs Single-Player Drift",
    objective:
      "Catalogue every mechanic known to change with server settings so cross-source comparisons can be corrected.",
    domain: "mechanics",
    priority: 4,
  },
  {
    code: "CAMPAIGN-09",
    title: "Experimental Compositions vs Conventional Meta",
    objective:
      "Compare promising unconventional compositions against the standard Rex/Daeodon/Yuty benchmark on estimated damage, sustain and cost.",
    domain: "meta-analysis",
    priority: 2,
  },
  {
    code: "CAMPAIGN-10",
    title: "Undocumented Mechanics Shortlist",
    objective:
      "Produce the ranked list of undocumented mechanics most worth manual experimental investigation, with a designed experiment for each.",
    domain: "mechanics",
    priority: 1,
  },
];
