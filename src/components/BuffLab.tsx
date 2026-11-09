"use client";

import { useMemo, useState } from "react";

type Buff = {
  slug: string;
  name: string;
  kind: string;
  category: string;
  scope: string;
  sourceType: string;
  effects: { stat: string; mode: string; value: number | null; unit?: string }[];
  stacking: string;
  exclusiveWith: string[];
  durationSec: number | null;
  notes: string;
  confidence: string;
  providers: string[];
};

type Interaction = { verdict: string; note: string; confidence: string };

const VERDICT_TONE: Record<string, string> = {
  stacks: "text-tactical",
  "does-not-stack": "text-amber",
  exclusive: "text-danger",
  "shared-source-refresh": "text-amber",
  unknown: "text-amber",
};

export function BuffLab({ buffs }: { buffs: Buff[] }) {
  const [a, setA] = useState(buffs.find((b) => b.slug === "yuty-courage-roar")?.slug ?? buffs[0]?.slug ?? "");
  const [b, setB] = useState(buffs.find((x) => x.slug === "daeodon-heal-aura")?.slug ?? buffs[1]?.slug ?? "");
  const [result, setResult] = useState<Interaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const buffA = buffs.find((x) => x.slug === a);
  const buffB = buffs.find((x) => x.slug === b);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return buffs;
    return buffs.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.category.includes(q) ||
        x.kind.includes(q) ||
        x.sourceType.includes(q),
    );
  }, [buffs, filter]);

  async function analyse() {
    setLoading(true);
    try {
      const res = await fetch("/api/buffs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ a, b }),
      });
      const json = (await res.json()) as { interaction?: Interaction };
      if (json.interaction) setResult(json.interaction);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel rounded-lg p-4">
        <div className="data-font mb-2 text-[10px] uppercase tracking-[0.2em] text-tactical">Pairwise interaction test</div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={a} onChange={(e) => setA(e.target.value)} className="data-font min-w-[220px] flex-1 rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200">
            {buffs.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.name}
              </option>
            ))}
          </select>
          <span className="data-font text-[12px] text-slate-500">+</span>
          <select value={b} onChange={(e) => setB(e.target.value)} className="data-font min-w-[220px] flex-1 rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200">
            {buffs.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={analyse}
            disabled={loading}
            className="data-font rounded border border-tactical/50 bg-tactical/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-tactical disabled:opacity-40"
          >
            {loading ? "Testing…" : "Classify interaction"}
          </button>
        </div>

        {result ? (
          <div className="mt-3 rounded border border-edge bg-panel-2/40 p-3">
            <div className={`data-font text-[11px] uppercase tracking-[0.2em] ${VERDICT_TONE[result.verdict] ?? "text-slate-300"}`}>
              {result.verdict}
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-300">{result.note}</p>
            <div className="data-font mt-1 text-[10px] text-slate-600">confidence: {result.confidence}</div>
          </div>
        ) : null}

        {buffA && buffB ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[buffA, buffB].map((x, i) => (
              <div key={x.slug} className="rounded border border-edge/60 bg-panel-2/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="data-font text-[10px] text-slate-600">effect {i + 1}</span>
                  <span className="text-[13px] font-medium text-slate-100">{x.name}</span>
                </div>
                <div className="data-font mt-1 text-[10px] text-slate-500">
                  {x.kind} · {x.category} · {x.scope} · stacking {x.stacking} · {x.confidence}
                </div>
                <ul className="mt-2 space-y-1">
                  {x.effects.map((e, idx) => (
                    <li key={idx} className="data-font text-[11px] text-slate-300">
                      {e.stat}: {e.mode}
                      {typeof e.value === "number" ? ` ${e.value}` : " (magnitude undocumented)"} {e.unit ?? ""}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] leading-snug text-slate-400">{x.notes}</p>
                {x.providers.length > 0 ? (
                  <div className="data-font mt-1 text-[10px] text-slate-600">providers: {x.providers.join(", ")}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="data-font text-[10px] uppercase tracking-[0.2em] text-tactical">Interaction database</div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name, category, kind or source…"
            className="min-w-[220px] flex-1 rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <div className="mt-3 space-y-2">
          {filtered.map((x) => (
            <div key={x.slug} className="rounded border border-edge/60 bg-panel-2/30 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-medium text-slate-100">{x.name}</span>
                <span className={`data-font text-[9px] uppercase ${x.confidence === "documented" ? "text-tactical" : "text-amber"}`}>
                  {x.confidence}
                </span>
                <span className="data-font ml-auto text-[10px] text-slate-500">{x.stacking}</span>
              </div>
              <div className="data-font mt-1 text-[10px] text-slate-600">
                {x.kind} · {x.category} · {x.scope} · source {x.sourceType}
                {x.durationSec ? ` · ${x.durationSec}s` : ""}
                {x.exclusiveWith?.length ? ` · exclusive with ${x.exclusiveWith.join(", ")}` : ""}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">{x.notes}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
