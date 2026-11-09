"use client";

import { useState } from "react";

type ExperimentOption = { code: string; title: string };

export function ExperimentRecorder({ experiments }: { experiments: ExperimentOption[] }) {
  const [code, setCode] = useState(experiments[0]?.code ?? "");
  const [replicates, setReplicates] = useState(3);
  const [notes, setNotes] = useState("");
  const [metric, setMetric] = useState("damage-per-swing");
  const [direction, setDirection] = useState<"higher" | "lower">("higher");
  const [baseline, setBaseline] = useState("");
  const [experimental, setExperimental] = useState("");
  const [rows, setRows] = useState<
    { metric: string; baseline: number | null; experimental: number | null; direction?: "higher" | "lower" }[]
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function addRow() {
    const b = baseline.trim() === "" ? null : Number(baseline);
    const e = experimental.trim() === "" ? null : Number(experimental);
    if (b === null || e === null || Number.isNaN(b) || Number.isNaN(e)) {
      setMessage("Both baseline and experimental values must be numbers you actually recorded.");
      return;
    }
    setRows((prev) => [...prev, { metric, baseline: b, experimental: e, direction }]);
    setBaseline("");
    setExperimental("");
    setMessage(null);
  }

  async function submit() {
    if (!code || rows.length === 0) {
      setMessage("Select an experiment and add at least one measurement row.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ experimentCode: code, measurements: rows, replicates, notes }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        classification?: string;
        confidence?: number;
        limitations?: string[];
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to record results");
      setMessage(
        `Recorded. Classification: ${json.classification} at confidence ${json.confidence}. ${
          json.limitations?.[0] ?? ""
        }`,
      );
      setRows([]);
      setNotes("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to record results");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel rounded-lg p-4">
      <div className="data-font mb-2 text-[10px] uppercase tracking-[0.2em] text-amber">
        Record real measurements (evidence import)
      </div>
      <p className="mb-3 text-[11px] leading-snug text-slate-400">
        The platform never writes a result on its own. Enter numbers you measured in-game; the classification engine will
        grade them (UNVERIFIED → PARTIALLY-VALIDATED → EXPERIMENTALLY-CONFIRMED → INDEPENDENTLY-REPLICATED) from the
        number of replicates, the consistency of the deltas and whether evidence is attached.
      </p>

      <div className="flex flex-wrap gap-2">
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="data-font min-w-[240px] flex-1 rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200"
        >
          {experiments.map((e) => (
            <option key={e.code} value={e.code}>
              {e.code} — {e.title.slice(0, 70)}
            </option>
          ))}
        </select>
        <label className="data-font flex items-center gap-2 rounded border border-edge px-2 py-1.5 text-[11px] text-slate-300">
          replicates
          <input
            type="number"
            min={1}
            max={20}
            value={replicates}
            onChange={(e) => setReplicates(Number(e.target.value))}
            className="data-font w-14 bg-void text-slate-200"
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          placeholder="metric name (e.g. damage-per-swing)"
          className="min-w-[180px] flex-1 rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200"
        />
        <input
          value={baseline}
          onChange={(e) => setBaseline(e.target.value)}
          placeholder="baseline"
          inputMode="decimal"
          className="data-font w-28 rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200"
        />
        <input
          value={experimental}
          onChange={(e) => setExperimental(e.target.value)}
          placeholder="experimental"
          inputMode="decimal"
          className="data-font w-28 rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200"
        />
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as "higher" | "lower")}
          className="data-font rounded border border-edge bg-void px-2 py-1.5 text-[11px] text-slate-200"
          title="Whether a bigger number is better for this metric"
        >
          <option value="higher">higher is better</option>
          <option value="lower">lower is better</option>
        </select>
        <button
          type="button"
          onClick={addRow}
          className="data-font rounded border border-edge px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-slate-300 hover:border-tactical/40"
        >
          Add
        </button>
      </div>

      {rows.length > 0 ? (
        <ul className="data-font mt-2 space-y-1 text-[11px] text-slate-300">
          {rows.map((r, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-slate-500">{r.metric}</span>
              <span>
                {r.baseline} → {r.experimental}
              </span>
              <span className="text-amber">
                {r.baseline ? `${Math.round(((r.experimental ?? 0) - r.baseline) / Math.abs(r.baseline) * 1000) / 10}%` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Conditions you actually used: game version, map, server settings, creature levels, stat points, saddle quality, evidence links…"
        rows={3}
        className="mt-2 w-full rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="data-font rounded border border-amber/50 bg-amber/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-amber disabled:opacity-40"
        >
          {busy ? "Recording…" : "Record results"}
        </button>
        <button
          type="button"
          onClick={() => setRows([])}
          className="data-font rounded border border-edge px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-slate-400"
        >
          Clear
        </button>
      </div>

      {message ? (
        <p className="mt-2 rounded border border-edge bg-panel-2 px-3 py-2 text-[12px] leading-snug text-slate-300">{message}</p>
      ) : null}
    </div>
  );
}
