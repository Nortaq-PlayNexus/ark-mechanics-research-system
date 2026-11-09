import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { abilities, creatureBuffs, creatures, discoveries } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { BUFF_BY_SLUG, CREATURE_BY_SLUG } from "@/lib/ark";
import { ClassificationBadge, KeyValue, Meter, PageHeader, Panel, Tag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CreatureDossierPage({ params }: { params: Promise<{ slug: string }> }) {
  await ensureSeeded();
  const { slug } = await params;
  const [creature] = await db.select().from(creatures).where(eq(creatures.slug, slug)).limit(1);
  if (!creature) notFound();

  const [abilityRows, buffRows, discoveryRows] = await Promise.all([
    db.select().from(abilities).where(eq(abilities.creatureSlug, slug)),
    db.select().from(creatureBuffs).where(eq(creatureBuffs.creatureSlug, slug)),
    db.select().from(discoveries),
  ]);
  const related = discoveryRows.filter((d) => (d.creatureSlugs ?? []).includes(slug));

  return (
    <div>
      <PageHeader kicker="Creature dossier" title={creature.name} subtitle={creature.notes} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/creatures" className="data-font text-[11px] uppercase tracking-[0.2em] text-tactical">
          ← Back to encyclopedia
        </Link>
        <Tag tone="cool">{creature.species}</Tag>
        <Tag>{creature.diet}</Tag>
        <Tag>{creature.temperament}</Tag>
        <Tag tone="amber">{creature.tier}</Tag>
        {creature.underrated ? <Tag tone="amber">underrated</Tag> : null}
        <Tag tone={creature.confidence === "documented" ? "tactical" : "amber"}>{creature.confidence}</Tag>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Combat profile" subtitle="analyst rating 0-100" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <Meter label="Damage" value={creature.profile.damage} />
            <Meter label="Mitigation" value={creature.profile.mitigation} tone="cool" />
            <Meter label="Healing" value={creature.profile.healing} tone="tactical" />
            <Meter label="Crowd control" value={creature.profile.cc} tone="amber" />
            <Meter label="Mobility" value={creature.profile.mobility} />
            <Meter label="Weight" value={creature.profile.weight} tone="cool" />
            <Meter label="Utility" value={creature.profile.utility} tone="amber" />
            <Meter label="Siege" value={creature.profile.siege} tone="danger" />
          </div>
          <div className="mt-4">
            <KeyValue
              items={[
                { label: "Rideable", value: creature.rideable ? "Yes" : "No" },
                { label: "Saddle", value: creature.saddle ?? "None" },
                { label: "Saddle armour (base)", value: creature.saddleArmor ? String(creature.saddleArmor) : "n/a" },
                { label: "Base HP (approx)", value: String(creature.baseHp) },
                { label: "Base melee (approx)", value: String(creature.baseMelee) },
                { label: "Base weight (approx)", value: String(creature.baseWeight) },
                { label: "Mobility index (1-100)", value: String(creature.baseSpeed) },
                { label: "Maps", value: (creature.maps ?? []).join(", ") },
              ]}
            />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Roles & tags">
            <div className="flex flex-wrap gap-1">
              {(creature.roles ?? []).map((r) => (
                <Tag key={r} tone="tactical">
                  {r}
                </Tag>
              ))}
              {(creature.tags ?? []).map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
            {(creature.weightReductions ?? []).length > 0 ? (
              <div className="mt-3">
                <div className="data-font mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Weight reductions</div>
                <ul className="space-y-1 text-[11px] text-slate-300">
                  {(creature.weightReductions ?? []).map((w) => (
                    <li key={w.resource}>
                      {w.resource}: ~{w.pct}%
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>

          <Panel title="Sources">
            <ul className="space-y-1">
              {(creature.sourceKeys ?? []).map((s) => (
                <li key={s} className="data-font text-[10px] text-slate-500">
                  {s}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Abilities" subtitle={`${abilityRows.length} records`} className="mt-4">
        <ul className="space-y-3">
          {abilityRows.map((a) => (
            <li key={a.id} className="border-b border-edge/50 pb-3 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-slate-100">{a.name}</span>
                <Tag tone="cool">{a.kind}</Tag>
                <Tag tone={a.confidence === "documented" ? "tactical" : "amber"}>{a.confidence}</Tag>
                {!a.documented ? <Tag tone="danger">unverified</Tag> : null}
                {(a.grantsBuffs ?? []).map((b) => (
                  <Tag key={b} tone="amber">
                    grants {BUFF_BY_SLUG.get(b)?.name ?? b}
                  </Tag>
                ))}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{a.description}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Buff relationships">
          {buffRows.length === 0 ? (
            <p className="text-[12px] text-slate-500">No buff relationships recorded.</p>
          ) : (
            <ul className="space-y-2">
              {buffRows.map((r) => {
                const b = BUFF_BY_SLUG.get(r.buffSlug);
                return (
                  <li key={r.id} className="rounded border border-edge/60 bg-panel-2/40 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag tone={r.relation === "grants" ? "tactical" : r.relation === "immune" ? "cool" : "amber"}>{r.relation}</Tag>
                      <span className="text-[12px] text-slate-200">{b?.name ?? r.buffSlug}</span>
                    </div>
                    {b ? <p className="mt-1 text-[11px] leading-snug text-slate-400">{b.notes}</p> : null}
                    {b ? (
                      <div className="data-font mt-1 text-[10px] text-slate-600">
                        {b.stacking} · {b.confidence} · {b.scope}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Related research">
          {related.length === 0 ? (
            <p className="text-[12px] text-slate-500">
              No discoveries reference this creature yet. Run a research pass from the agent control centre to generate one.
            </p>
          ) : (
            <ul className="space-y-2">
              {related.slice(0, 8).map((d) => (
                <li key={d.code} className="border-b border-edge/50 pb-2 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClassificationBadge value={d.classification} />
                    <span className="data-font text-[10px] text-slate-600">{d.foundBy}</span>
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-slate-200">{d.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">{d.summary}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="data-font mt-3 text-[10px] text-slate-600">
            Combination engine profile for this creature feeds {CREATURE_BY_SLUG.size} other dossiers.
          </div>
        </Panel>
      </div>
    </div>
  );
}
