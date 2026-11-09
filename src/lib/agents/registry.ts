export interface AgentDefinition {
  code: string;
  name: string;
  role: string;
  domain: string;
  mandate: string;
  methods: string[];
}

/** The twelve autonomous research agents of ARK OMNISCIENCE. */
export const AGENTS: AgentDefinition[] = [
  {
    code: "AGENT-01",
    name: "Creature Intelligence Specialist",
    role: "Creature dossier & ability audit",
    domain: "creature-intelligence",
    mandate:
      "Investigate every creature's abilities, passives, buffs, saddle interactions, weight and carrying mechanics, damage/resistance modifiers, mobility, special attacks, status effects, hidden mechanics and creature-to-creature interactions.",
    methods: [
      "Ability enumeration per creature",
      "Saddle and armour interaction audit",
      "Weight-reduction and carry-capacity review",
      "Hidden/undocumented behaviour flagging",
      "Cross-creature interaction mapping",
    ],
  },
  {
    code: "AGENT-02",
    name: "Synergy Discovery Scientist",
    role: "Combination discovery",
    domain: "synergy",
    mandate:
      "Find two- and three-creature combinations and larger formations whose combined output exceeds the sum of their parts: buff stacking, amplification, complementary abilities, defensive and healing combinations, mobility and crowd-control interactions.",
    methods: [
      "Bounded pair/triple enumeration with the synergy engine",
      "Baseline comparison against best single member",
      "Buff compatibility screening",
      "Support-role coverage analysis",
    ],
  },
  {
    code: "AGENT-03",
    name: "Raid Intelligence Specialist",
    role: "Offensive & defensive raid research",
    domain: "raid-intelligence",
    mandate:
      "Research creature combinations for attacking and defending bases: structure damage, mitigation, tanking, healing support, positioning, assault formations, siege utility, anti-creature defence and resource efficiency across raid scenarios.",
    methods: [
      "Soak and damage-typing analysis",
      "Siege metric ranking",
      "Formation modelling per raid scenario",
      "Cost-per-objective estimation",
    ],
  },
  {
    code: "AGENT-04",
    name: "Buff & Status Effect Researcher",
    role: "Buff interaction database",
    domain: "buff-interaction",
    mandate:
      "Build the comprehensive buff interaction database: every creature and player buff, resistance, damage, armour, healing, food, stamina, temperature and status effect — with duration, stacking restrictions, multiplicative vs additive behaviour, exclusivity and conditional effects.",
    methods: [
      "Pairwise buff compatibility matrix",
      "Modifier-mode classification (additive/multiplicative/override)",
      "Player-buff x creature-aura cross-testing",
      "Exclusivity and shared-slot detection",
    ],
  },
  {
    code: "AGENT-05",
    name: "Breeding & Genetics Researcher",
    role: "Stat inheritance and mutation strategy",
    domain: "breeding",
    mandate:
      "Investigate breeding systems, mutation mechanics, stat inheritance, imprinting, stat distributions, mutation stacking rules and creature-specific breeding strategies for specialised combat roles.",
    methods: [
      "Stat-priority mapping per combat role",
      "Mutation-line separation modelling",
      "Imprint value analysis",
      "Nursery throughput economics",
    ],
  },
  {
    code: "AGENT-06",
    name: "PvP Meta Investigator",
    role: "Meta analysis & counters",
    domain: "pvp-meta",
    mandate:
      "Investigate current PvP compositions, counter-combinations, defensive and offensive configurations, mobility strategies, support roles, battlefield control, unusual matchups, underutilised creatures and situational counters.",
    methods: [
      "Counter-matrix construction",
      "Cost-per-effect comparison against meta creatures",
      "Underutilised creature re-scoring",
      "Control-chain (CC chain) analysis",
    ],
  },
  {
    code: "AGENT-07",
    name: "PvE & Boss Specialist",
    role: "Boss composition research",
    domain: "pve-boss",
    mandate:
      "Research boss compositions, boss-specific counters, resistance requirements, damage optimisation, healing and support roles, arena restrictions, boss mechanics, difficulty configurations and efficient progression combinations.",
    methods: [
      "Arena restriction filtering",
      "Boss counter-pattern matching",
      "Sustain vs burst requirement modelling",
      "Progression efficiency ranking",
    ],
  },
  {
    code: "AGENT-08",
    name: "Mechanics & Glitch Investigator",
    role: "Undocumented mechanics",
    domain: "mechanics",
    mandate:
      "Investigate poorly understood mechanics: unexpected ability interactions, hidden stat calculations, unusual behaviour, buff application conditions, stacking anomalies, mode/map/version differences, and inconsistencies between documentation and behaviour. Separate legitimate mechanics from exploits and patched behaviour.",
    methods: [
      "Documentation-vs-behaviour gap analysis",
      "Version and mode drift cataloguing",
      "Exploit/bug/mechanic triage",
      "Confounding variable identification",
    ],
  },
  {
    code: "AGENT-09",
    name: "Data Mining & Knowledge Researcher",
    role: "Source acquisition & cross-referencing",
    domain: "data-research",
    mandate:
      "Collect and cross-reference publicly available ARK information: official documentation, wikis, patch notes, developer announcements, community discoveries, discussions, databases and reports. Maintain citations, version information and source reliability ratings.",
    methods: [
      "Source registry maintenance",
      "Cross-source disagreement detection",
      "Reliability scoring",
      "Gap identification (missing primary sources)",
    ],
  },
  {
    code: "AGENT-10",
    name: "Experimental Validation Scientist",
    role: "Experiment design & validation",
    domain: "validation",
    mandate:
      "Prove or disprove discoveries: establish hypotheses, identify creatures and abilities, define baselines and conditions, design repeatable procedures, record results, identify confounds, compute measurable differences and classify outcomes. Never mark an untested theory as confirmed.",
    methods: [
      "Baseline-then-variable experiment design",
      "Repeat and replicate planning",
      "Confounding variable control",
      "Manual result import & classification",
    ],
  },
  {
    code: "AGENT-11",
    name: "Meta Analyst",
    role: "Cross-agent synthesis",
    domain: "meta-analysis",
    mandate:
      "Compare all research findings, identify the strongest and most underrated combinations, the best counters, the best breeding investments, and connections between discoveries made by different agents.",
    methods: [
      "Cross-agent finding aggregation",
      "Benchmark comparison against conventional meta",
      "Ranking and leaderboards",
      "Connection discovery between agent findings",
    ],
  },
  {
    code: "AGENT-12",
    name: "Chief Research Director",
    role: "Coordination & publication",
    domain: "coordination",
    mandate:
      "Coordinate all agents: assign tasks, prevent duplication, identify unanswered questions, prioritise hypotheses, challenge unsupported conclusions, request experiments, resolve conflicts, maintain the central database and publish verified discoveries.",
    methods: [
      "Task allocation and deduplication",
      "Priority queue management",
      "Evidence-challenge review",
      "Campaign and report publication",
    ],
  },
];

export const AGENT_BY_CODE = new Map(AGENTS.map((a) => [a.code, a]));

export function agentName(code: string): string {
  return AGENT_BY_CODE.get(code)?.name ?? code;
}
