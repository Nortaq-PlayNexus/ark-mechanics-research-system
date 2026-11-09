import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { ensureSeeded, DEFAULT_SETTINGS } from "@/lib/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return NextResponse.json({ settings: row?.config ?? DEFAULT_SETTINGS });
}

export async function PUT(request: Request) {
  await ensureSeeded();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const current = row?.config ?? DEFAULT_SETTINGS;
  const next = {
    ...current,
    ...body,
    autonomy: { ...current.autonomy, ...(body.autonomy as object | undefined) },
    ai: { ...current.ai, ...(body.ai as object | undefined) },
    logging: { ...current.logging, ...(body.logging as object | undefined) },
  };
  await db.update(settings).set({ config: next, updatedAt: new Date() }).where(eq(settings.id, 1));
  return NextResponse.json({ ok: true, settings: next });
}
