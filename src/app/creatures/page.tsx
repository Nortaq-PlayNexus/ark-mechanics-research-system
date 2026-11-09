import Link from "next/link";
import { db } from "@/db";
import { creatures as creaturesTable } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { DataTable, PageHeader, Panel, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CreatureEncyclopediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string; underrated?: string }>;
}) {
  await ensureSeeded();
  const params = await searchParams;
  const rows = await db.select().from(creaturesTable);
  const q = (params.q ?? "").toLowerCase();
  const filtered = rows.filter((c) => {
    if (params.underrated === "1" && !c.underrated) return false;
    if (params.tier && c.tier !== params.tier) return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.species.toLowerCase().includes(q) ||
      (c.roles ?? []).join(" ").toLowerCase().includes(q) ||
      (c.tags ?? []).join(" ").toLowerCase().includes(q)
    );
  });

  const tiers = ["shoulder", "small", "medium", "large", "titan"];

  return (
    <div>
      <PageHeader
        kicker="Section 03 · Creature Encyclopedia"
        title="Creature Intelligence Database"
        subtitle={`${rows.length} creatures with ability records, buff grants, immunities, weight reductions and map availability. Profile values are ARK Omniscience analyst ratings (0-100) used by the combination engine — base stats are approximate published values for triage only.`}
      />

      <form className="panel mb-4 flex flex-wrap gap-2 rounded-lg p-3" action="/creatures">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search name, role or tag…"
          className="min-w-[220px] flex-1 rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600"
        />
        <select
          name="tier"
          defaultValue={params.tier ?? ""}
          className="data-font rounded border border-edge bg-void px-2 py-1.5 text-[12px] text-slate-200"
        >
          <option value="">all tiers</option>
          {tiers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="data-font flex items-center gap-2 rounded border border-edge px-2 py-1.5 text-[11px] text-slate-300">
          <input type="checkbox" name="underrated" value="1" defaultChecked={params.underrated === "1"} />
          underrated only
        </label>
        <button
          type="submit"
          className="data-font rounded border border-tactical/50 bg-tactical/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-tactical"
        >
          Filter
        </button>
      </form>

      <Panel title="Creatures" subtitle={`${filtered.length} shown`}>
        <DataTable
          head={["Creature", "Tier", "Saddle", "Roles", "Damage", "Mitigation", "Utility", "Control", "Confidence"]}
          rows={filtered.map((c) => [
            <div key="n">
              <Link href={`/creatures/${c.slug}`} className="text-[13px] font-medium text-slate-100 hover:text-tactical">
                {c.name}
              </Link>
              <div className="data-font text-[10px] italic text-slate-600">{c.species}</div>
            </div>,
            <span key="t" className="data-font text-[11px] text-slate-400">
              {c.tier}
              {c.underrated ? <span className="text-amber"> ★</span> : null}
            </span>,
            <span key="s" className="text-[11px] text-slate-400">{c.saddle ?? "none"}</span>,
            <div key="r" className="flex flex-wrap gap-1">
              {(c.roles ?? []).slice(0, 3).map((r) => (
                <Tag key={r}>{r}</Tag>
              ))}
            </div>,
            <span key="d" className="data-font text-[12px] text-tactical">{c.profile.damage}</span>,
            <span key="m" className="data-font text-[12px] text-cool">{c.profile.mitigation}</span>,
            <span key="u" className="data-font text-[12px] text-amber">{c.profile.utility}</span>,
            <span key="c" className="data-font text-[12px] text-slate-300">{c.profile.cc}</span>,
            <Tag key="cf" tone={c.confidence === "documented" ? "tactical" : c.confidence === "community-reported" ? "amber" : "danger"}>
              {c.confidence}
            </Tag>,
          ])}
        />
      </Panel>
    </div>
  );
}
