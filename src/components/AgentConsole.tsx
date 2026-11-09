"use client";

import { useState } from "react";
import type { AgentRunResult } from "@/lib/agents/execution";

export function AgentConsole({ agents }: { agents: { code: string; name: string; role: string; domain: string }[] }) {
  const [selected, setSelected] = useState<string>(agents[0]?.code ?? "AGENT-01");
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; data: AgentRunResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");

  async function run(agentCode: string) {
    setRunning(agentCode);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentCode }),
      });
      const json = (await res.json()) as { result?: AgentRunResult; error?: string };
      if (!res.ok || !json.result) throw new Error(json.error ?? "Agent run failed");
      setResult({ code: agentCode, data: json.result });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent run failed");
    } finally {
      setRunning(null);
    }
  }

  async function queueTask() {
    if (!taskTitle.trim()) return;
    setRunning(selected);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentCode: selected, title: taskTitle, question: "Operator-directed investigation", priority: 1 }),
      });
      const json = (await res.json()) as { ok?: boolean; code?: string; duplicate?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to queue task");
      setTaskTitle("");
      setError(json.duplicate ? `Task already exists in the queue (${json.code}) — deduplicated.` : `Task ${json.code} queued for ${selected}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue task");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel rounded-lg p-4">
        <div className="data-font mb-2 text-[10px] uppercase tracking-[0.2em] text-tactical">Agent control</div>
        <div className="flex flex-wrap gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="data-font rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200"
          >
            {agents.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => run(selected)}
            disabled={running !== null}
            className="data-font rounded border border-tactical/50 bg-tactical/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-tactical transition hover:bg-tactical/20 disabled:opacity-40"
          >
            {running === selected ? "Running…" : "Run research pass"}
          </button>
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Assign a new research task…"
            className="min-w-[220px] flex-1 rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={queueTask}
            disabled={running !== null}
            className="data-font rounded border border-amber/50 bg-amber/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-amber transition hover:bg-amber/20 disabled:opacity-40"
          >
            Queue task
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              setRunning("cycle");
              try {
                const res = await fetch("/api/orchestrator", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({}),
                });
                const json = (await res.json()) as { ok?: boolean; error?: string };
                setError(
                  json.ok
                    ? "Full research cycle completed. New hypotheses, tasks, experiments and reports have been generated."
                    : json.error ?? "Cycle failed",
                );
              } finally {
                setRunning(null);
              }
            }}
            disabled={running !== null}
            className="data-font rounded border border-cool/50 bg-cool/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-cool transition hover:bg-cool/20 disabled:opacity-40"
          >
            {running === "cycle" ? "Running cycle…" : "Run full research cycle"}
          </button>
          <button
            type="button"
            onClick={async () => {
              setRunning("reports");
              try {
                const res = await fetch("/api/reports", { method: "POST" });
                const json = (await res.json()) as { ok?: boolean; error?: string };
                setError(json.ok ? "All ten research reports regenerated from current data." : json.error ?? "Report generation failed");
              } finally {
                setRunning(null);
              }
            }}
            disabled={running !== null}
            className="data-font rounded border border-edge px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-slate-300 transition hover:border-tactical/40 disabled:opacity-40"
          >
            {running === "reports" ? "Generating…" : "Regenerate reports"}
          </button>
        </div>
        {error ? <p className="mt-3 rounded border border-edge bg-panel-2 px-3 py-2 text-[12px] text-slate-300">{error}</p> : null}
      </div>

      {result ? (
        <div className="panel rounded-lg p-4">
          <div className="data-font mb-2 text-[10px] uppercase tracking-[0.2em] text-amber">
            {result.code} run result — {result.data.findings.length} findings
          </div>
          <div className="data-font mb-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
            <span>combinations analysed: {result.data.stats.combinationsAnalysed}</span>
            <span>hypotheses reviewed: {result.data.stats.hypothesesReviewed}</span>
            <span>tasks: {result.data.taskOutcomes.length}</span>
          </div>
          <ul className="space-y-2">
            {result.data.findings.map((f, i) => (
              <li key={i} className="border-b border-edge/50 pb-2 last:border-0">
                <p className="text-[13px] font-medium text-slate-200">{f.title}</p>
                <p className="mt-1 text-[12px] leading-snug text-slate-400">{f.summary}</p>
                <div className="data-font mt-1 text-[10px] text-slate-600">
                  {f.classification} · confidence {f.confidenceScore} · {f.evidenceQuality}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
