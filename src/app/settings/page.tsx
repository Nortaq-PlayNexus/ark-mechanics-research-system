import { db } from "@/db";
import { settings } from "@/db/schema";
import { ensureSeeded, DEFAULT_SETTINGS } from "@/lib/db/seed";
import { KB_STATS } from "@/lib/ark";
import { KeyValue, PageHeader, Panel, StatTile, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await ensureSeeded();
  const [row] = await db.select().from(settings);
  const config = row?.config ?? DEFAULT_SETTINGS;

  return (
    <div>
      <PageHeader
        kicker="Section 14 · Settings & Data"
        title="Configuration, Import / Export & Backup"
        subtitle="The platform is offline-first: every agent runs on local deterministic heuristics over the knowledge base, and no external AI provider is required. An optional OpenAI-compatible or Ollama endpoint can be configured to enrich agent narration, but no key is ever assumed to exist."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Creatures" value={KB_STATS.creatures} />
        <StatTile label="Effects" value={KB_STATS.buffs} accent="amber" />
        <StatTile label="Abilities" value={KB_STATS.abilities} accent="cool" />
        <StatTile label="Knowledge relations" value={KB_STATS.relations} accent="muted" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Research configuration">
          <KeyValue
            items={[
              { label: "Game version", value: config.gameVersion },
              { label: "Default map", value: config.defaultMap },
              { label: "Default mode", value: config.defaultMode },
              { label: "Server settings", value: config.serverSettings },
              { label: "Autonomous cycles", value: config.autonomy.autoRun ? "enabled" : "disabled" },
              { label: "Max tasks per cycle", value: String(config.autonomy.maxTasksPerCycle) },
              { label: "Max hypotheses per cycle", value: String(config.autonomy.maxHypothesesPerCycle) },
              { label: "Minimum priority to enqueue", value: String(config.autonomy.minPriority) },
              { label: "Log level", value: config.logging.level },
            ]}
          />
        </Panel>

        <Panel title="AI provider configuration" subtitle="optional — never required">
          <KeyValue
            items={[
              { label: "Provider", value: config.ai.provider },
              { label: "Base URL", value: config.ai.baseUrl ?? "not configured" },
              { label: "Model", value: config.ai.model ?? "not configured" },
              { label: "API key environment variable", value: config.ai.apiKeyEnv ?? "none" },
            ]}
          />
          <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-slate-400">
            <p>
              <span className="text-tactical">Local heuristic engine (default).</span> All twelve agents run deterministically
              against the knowledge base: hypothesis generation, combination enumeration, buff compatibility, conflict
              detection and report generation require no network access and no API key.
            </p>
            <p>
              <span className="text-amber">Optional external provider.</span> Set{" "}
              <code className="data-font text-slate-300">{config.ai.apiKeyEnv}</code> in the environment to enable
              OpenAI-compatible or Ollama enrichment. If the variable is absent the platform silently continues in local
              mode.
            </p>
          </div>
        </Panel>
      </div>

      <Panel title="Import, export and backup" className="mt-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-edge/60 bg-panel-2/30 p-3">
            <div className="data-font text-[10px] uppercase tracking-[0.2em] text-tactical">Full database export</div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Downloads every creature, effect, combination, hypothesis, experiment, discovery, source and report as a single
              JSON document for backup or transfer to another installation.
            </p>
            <a
              href="/api/export"
              className="data-font mt-2 inline-block rounded border border-tactical/50 bg-tactical/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-tactical"
            >
              Download export
            </a>
          </div>
          <div className="rounded border border-edge/60 bg-panel-2/30 p-3">
            <div className="data-font text-[10px] uppercase tracking-[0.2em] text-amber">Evidence import</div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              POST recorded measurements to <code className="data-font">/api/experiments</code> with an experiment code, a
              metric list and replicate count. This is the only path from UNVERIFIED to a validated classification.
            </p>
            <code className="data-font mt-2 block text-[10px] leading-snug text-slate-500">
              {`{ "experimentCode": "EXP-0001", "measurements": [{ "metric": "damage-per-swing", "baseline": 100, "experimental": 152 }], "replicates": 3, "notes": "…" }`}
            </code>
          </div>
          <div className="rounded border border-edge/60 bg-panel-2/30 p-3">
            <div className="data-font text-[10px] uppercase tracking-[0.2em] text-cool">API surface</div>
            <ul className="data-font mt-1 space-y-1 text-[10px] text-slate-500">
              <li>GET /api/health</li>
              <li>GET /api/state</li>
              <li>GET /api/creatures?slug=…</li>
              <li>GET /api/buffs?matrix=1</li>
              <li>GET|POST /api/combinations</li>
              <li>GET|POST /api/agents</li>
              <li>GET|POST|PATCH /api/tasks</li>
              <li>GET /api/research?type=hypotheses</li>
              <li>GET|POST /api/experiments</li>
              <li>GET|POST /api/reports</li>
              <li>POST /api/orchestrator</li>
              <li>GET|PUT /api/settings</li>
              <li>GET|POST /api/export</li>
            </ul>
          </div>
        </div>
      </Panel>

      <Panel title="Research integrity charter" className="mt-4">
        <ul className="space-y-2 text-[12px] leading-relaxed text-slate-400">
          <li>
            <Tag tone="tactical">Never fabricate</Tag> The platform does not generate test results, screenshots, videos or
            personal testing claims. Experiments are designed, not executed.
          </li>
          <li>
            <Tag tone="amber">Label uncertainty</Tag> Undocumented magnitudes are recorded as unknowns and excluded from
            arithmetic. Analyst ratings are never presented as in-game values.
          </li>
          <li>
            <Tag tone="cool">Traceability</Tag> Every discovery carries source keys and a confidence score derived from the
            reliability of its weakest source.
          </li>
          <li>
            <Tag>Separate mechanics from exploits</Tag> The mechanics investigator triages findings as legitimate mechanic,
            exploit, or patched behaviour, and never recommends an exploit.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
