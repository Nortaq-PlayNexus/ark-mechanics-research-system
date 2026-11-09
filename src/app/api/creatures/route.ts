import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { abilities, creatureBuffs, creatures } from "@/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { BUFF_BY_SLUG } from "@/lib/ark";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSeeded();
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const underrated = url.searchParams.get("underrated");

  if (slug) {
    const [creature] = await db.select().from(creatures).where(eq(creatures.slug, slug)).limit(1);
    if (!creature) return NextResponse.json({ error: "Creature not found" }, { status: 404 });
    const [abilityRows, buffRows] = await Promise.all([
      db.select().from(abilities).where(eq(abilities.creatureSlug, slug)),
      db.select().from(creatureBuffs).where(eq(creatureBuffs.creatureSlug, slug)),
    ]);
    return NextResponse.json({
      creature,
      abilities: abilityRows,
      buffs: buffRows.map((r) => ({ relation: r.relation, buff: BUFF_BY_SLUG.get(r.buffSlug) ?? { slug: r.buffSlug } })),
    });
  }

  const rows = await db.select().from(creatures).orderBy(asc(creatures.name));
  const filtered = underrated === "1" ? rows.filter((r) => r.underrated) : rows;
  return NextResponse.json({ count: filtered.length, creatures: filtered });
}
