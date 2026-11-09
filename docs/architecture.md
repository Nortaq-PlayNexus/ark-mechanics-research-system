# Architecture

```
                ┌────────────────────────────────────────────┐
                │        Next.js Web Command Centre          │
                │  15 sections + 13 REST API routes (src/)   │
                └───────┬──────────────────────┬─────────────┘
                        │ REST /api/*          │ PostgreSQL (optional at build)
                        ▼                      ▼
                ┌──────────────┐      ┌──────────────────┐
                │ 12 Agents    │      │ Drizzle ORM + DB │
                │ (execution)  │      │ (src/db, seed)   │
                └──────┬───────┘      └──────────────────┘
                       ▼
        ┌──────────────────────────────┐
        │ Engines: synergy / hypothesis│
        │ / experiment (deterministic) │
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │ Knowledge base (src/lib/ark) │
        │ 85 creatures · 61 buffs ·    │
        │ 8 bosses · relations         │
        └──────────────┬───────────────┘
                       │ exported to JSON snapshot
                       ▼
        ┌──────────────────────────────┐
        │ Desktop app (PySide6)        │
        │ core.py (logic) + app.py GUI │
        │ EmbeddedRepository (offline) │
        └──────────────────────────────┘
```

## Data flow

1. **Web**: pages call `/api/*` routes → engines/knowledge base → optional PostgreSQL persistence (`DATABASE_URL`). Without a database, `/api/health` reports `unavailable` instead of crashing (lazy DB initialisation).
2. **Desktop online**: `ApiClient` calls the same `/api/*` routes.
3. **Desktop offline**: `Repository.creatures()` / `.buffs()` fall back to `EmbeddedRepository`, which reads `desktop/ark_omniscience/data/knowledge_base.json`. Boss tab does the same. Agent/experiment/report actions still require the server and fail with a clear message.
4. **Snapshot**: regenerate with `npx tsx scripts/export-knowledge-base.ts` after changing `src/lib/ark/*`.

## Knowledge base

- `creatures.core.ts` / `creatures.support.ts` — creature roster + extra buff relations
- `buffs.ts` — buff definitions (effects, stacking, confidence)
- `auxiliary.ts` — boss records
- `types.ts` — shared types; profile 0–100 values are analyst ratings, not game numbers
