"use client";

import { useMemo, useState } from "react";

type CreatureOption = {
  slug: string;
  name: string;
  tier: string;
  roles: string[];
  underrated: boolean;
};

type Analysis = {
  memberSlugs: string[];
  members: { name: string; slug: string }[];
  context: string;
  metrics: Record<string, number>;
  partyScore: number;
  bestSingleScore: number;
  meanMemberScore: number;
  synergyDelta: number;
  synergyScore: number;
  buffInteractions: { a: string; b: string; verdict: string; note: string; confidence: string }[];
  conflicts: { severity: string; title: string; detail: string }[];
  documentedBuffs: { slug: string; name: string }[];
  unresolvedBuffs: { slug: string; name: string; confidence: string }[];
  estimatedDamageMultiplier: number;
  estimatedMitigation: number;
  supportCoverage: { role: string; covered: boolean; by: string[] }[];
  assumptions: string[];
  limitations: string[];
  rationale: string;
  classification: string;
  cost: { tameSlots: number; breedingLoad: number; resourceLoad: number };
};

const CONTEXTS = [
  { value: "raid-assault", label: "Raid assault" },
  { value: "raid-defence", label: "Raid defence" },
  { value: "boss-arena", label: "Boss arena" },
  { value: "pvp-open", label: "Open-field PvP" },
  { value: "pve-general", label: "PvE general" },
  { value: "logistics", label: "Logistics" },
];

export function CombinationExplorer({ creatures }: { creatures: CreatureOption[] }) {
  const [selected, setSelected] = useState<string[]>(["yutyrannus", "daeodon", "therizinosaurus"]);
  const [context, setContext] = useState("raid-assault");
  const [query, setQuery] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return creatures;
    return creatures.filter(
      (c) => c.name.toLowerCase().includes(q) || c.roles.join(" ").toLowerCase().includes(q) || c.tier.includes(q),
    );
  }, [creatures, query]);

  async function analyse() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/combinations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slugs: selected, context }),
      });
      const json = (await res.json()) as Analysis & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      setAnalysis(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function toggle(slug: string) {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug].slice(0, 8)));
  }

  return (
    <div className="space-y-4">
      <div className="panel rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="data-font rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200"
          >
            {CONTEXTS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter creatures by name, role or tier…"
            className="min-w-[220px] flex-1 rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={analyse}
            disabled={loading || selected.length < 2}
            className="data-font rounded border border-tactical/50 bg-tactical/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-tactical transition hover:bg-tactical/20 disabled:opacity-40"
          >
            {loading ? "Analysing…" : "Analyse combination"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {selected.map((s) => {
            const c = creatures.find((x) => x.slug === s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className="data-font rounded border border-tactical/40 bg-tactical/10 px-2 py-0.5 text-[10px] text-tactical"
              >
                {c?.name ?? s} ✕
              </button>
            );
          })}
          {selected.length < 2 ? <span className="text-[11px] text-slate-500">Select at least two creatures.</span> : null}
        </div>
        <div className="mt-3 max-h-56 overflow-y-auto rounded border border-edge/60">
          <div className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggle(c.slug)}
                className={`rounded border px-2 py-1 text-left text-[11px] transition ${
                  selected.includes(c.slug)
                    ? "border-tactical/50 bg-tactical/10 text-tactical"
                    : "border-edge/60 text-slate-300 hover:border-tactical/30"
                }`}
              >
                <div className="truncate">{c.name}</div>
                <div className="data-font truncate text-[9px] text-slate-600">
                  {c.tier}
                  {c.underrated ? " · underrated" : ""}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? <p className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</p> : null}

      {analysis ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel rounded-lg p-4 lg:col-span-2">
            <div className="data-font text-[10px] uppercase tracking-[0.2em] text-tactical">
              {analysis.context.replace("-", " ")} analysis
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">{analysis.members.map((m) => m.name).join(" + ")}</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{analysis.rationale}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded border border-edge bg-panel-2/40 p-3">
                <div className="data-font text-[10px] uppercase tracking-[0.2em] text-slate-500">Party score</div>
                <div className="data-font text-xl text-tactical">{analysis.partyScore}</div>
                <div className="data-font text-[10px] text-slate-600">best single {analysis.bestSingleScore}</div>
              </div>
              <div className="rounded border border-edge bg-panel-2/40 p-3">
                <div className="data-font text-[10px] uppercase tracking-[0.2em] text-slate-500">Synergy score</div>
                <div className="data-font text-xl text-amber">{analysis.synergyScore}</div>
                <div className="data-font text-[10px] text-slate-600">delta {analysis.synergyDelta > 0 ? "+" : ""}{analysis.synergyDelta}</div>
              </div>
              <div className="rounded border border-edge bg-panel-2/40 p-3">
                <div className="data-font text-[10px] uppercase tracking-[0.2em] text-slate-500">Documented buffs</div>
                <div className="data-font text-xl text-cool">×{analysis.estimatedDamageMultiplier}</div>
                <div className="data-font text-[10px] text-slate-600">resistance {Math.round(analysis.estimatedMitigation * 100)}%</div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {Object.entries(analysis.metrics).map(([key, value]) => (
                <div key={key} className="rounded border border-edge/60 px-2 py-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="data-font text-[10px] uppercase tracking-[0.15em] text-slate-500">{key}</span>
                    <span className="data-font text-[12px] text-slate-300">{Math.round(value * 10) / 10}</span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded bg-panel-2">
                    <div className="h-full bg-tactical" style={{ width: `${Math.min(100, (value / 250) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="data-font mb-1 text-[10px] uppercase tracking-[0.2em] text-tactical">Support coverage</div>
                <ul className="space-y-1">
                  {analysis.supportCoverage.map((c) => (
                    <li key={c.role} className="flex items-center gap-2 text-[11px]">
                      <span className={c.covered ? "text-tactical" : "text-slate-600"}>{c.covered ? "●" : "○"}</span>
                      <span className="text-slate-300">{c.role}</span>
                      <span className="data-font ml-auto truncate text-[10px] text-slate-600">{c.by.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="data-font mb-1 text-[10px] uppercase tracking-[0.2em] text-amber">Detected conflicts</div>
                {analysis.conflicts.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No conflicts detected in the knowledge base.</p>
                ) : (
                  <ul className="space-y-2">
                    {analysis.conflicts.map((c, i) => (
                      <li key={i} className="rounded border border-edge/60 bg-panel-2/40 p-2">
                        <div className="text-[11px] font-medium text-amber">{c.title}</div>
                        <div className="text-[11px] leading-snug text-slate-400">{c.detail}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel rounded-lg p-4">
              <div className="data-font mb-2 text-[10px] uppercase tracking-[0.2em] text-cool">Buff interactions</div>
              <ul className="space-y-2">
                {analysis.buffInteractions.slice(0, 12).map((i, idx) => (
                  <li key={idx} className="border-b border-edge/50 pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`data-font text-[9px] uppercase ${i.verdict === "unknown" ? "text-amber" : i.verdict === "exclusive" ? "text-danger" : "text-tactical"}`}>
                        {i.verdict}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300">{i.a} + {i.b}</div>
                    <div className="text-[10px] leading-snug text-slate-500">{i.note}</div>
                  </li>
                ))}
                {analysis.buffInteractions.length === 0 ? <li className="text-[11px] text-slate-500">No buffs present in this party.</li> : null}
              </ul>
            </div>

            <div className="panel rounded-lg p-4">
              <div className="data-font mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">Model assumptions</div>
              <ul className="space-y-1 text-[11px] leading-snug text-slate-400">
                {analysis.assumptions.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
              <div className="data-font mt-3 mb-1 text-[10px] uppercase tracking-[0.2em] text-amber">Limitations</div>
              <ul className="space-y-1 text-[11px] leading-snug text-slate-400">
                {analysis.limitations.map((l, i) => (
                  <li key={i}>• {l}</li>
                ))}
              </ul>
              <div className="data-font mt-3 text-[10px] text-slate-600">
                cost: {analysis.cost.tameSlots} slots · breeding load {analysis.cost.breedingLoad} · resources {analysis.cost.resourceLoad} ·
                classification {analysis.classification}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
