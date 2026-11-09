# Troubleshooting

## Web: "DATABASE_URL is required"

The web platform persists research state in PostgreSQL. Set the environment variable:

```powershell
$env:DATABASE_URL = "postgres://user:pass@localhost:5432/ark_omniscience"
```

`/api/health` returns `status: error, database: unavailable` (HTTP 500) when unset — it no longer crashes the server.

## Desktop: "Platform unreachable"

Expected when the web server is not running. The app enters offline mode: Creatures, Buffs and Bosses load from the embedded knowledge base (85 / 61 / 8 records). Agent runs, research cycles, combination analysis and live reports need the web platform on `http://127.0.0.1:3000` (changeable in Settings).

## Desktop: PySide6 missing

```powershell
pip install -r desktop/requirements.txt
```

## Next.js build fails on type checking

Run `npx tsc --noEmit` to see the exact location; `npm run build` type-checks before bundling.
