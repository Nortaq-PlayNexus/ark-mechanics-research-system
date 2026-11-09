# ARK Omniscience — Autonomous Research Division

![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)
![Web](https://img.shields.io/badge/web-Next.js%2016-black)
![Desktop](https://img.shields.io/badge/desktop-PySide6%20%2B%20PyInstaller-green)

A two-part ARK: Survival Ascended mechanics research platform: a **Next.js web command centre** (12 research agents, synergy/hypothesis/experiment engines, PostgreSQL via Drizzle) and a **standalone Windows desktop application** that runs fully offline from an embedded knowledge base — no database, no server required.

![Desktop application — Creature Encyclopedia](docs/screenshots/02-creature-encyclopedia.png)

## Quick start

### Windows desktop app (no setup)

1. Download the release ZIP and extract it anywhere.
2. Run `ArkOmniscience.exe`.
3. The Creature Encyclopedia (85 creatures), Buff Lab (61 effects) and PvE/Boss tabs work immediately from the embedded knowledge base.
4. Agent runs, research cycles and live reports require the web platform (below); the app says so clearly when offline.

### Development / web platform

```powershell
npm install
$env:DATABASE_URL = "postgres://user:pass@localhost:5432/ark_omniscience"
npm run dev        # http://localhost:3000
```

```powershell
# Desktop from source
pip install -r desktop/requirements.txt
python desktop/main.py

# Build the Windows EXE
pip install pyinstaller
pyinstaller --noconfirm --windowed --name ArkOmniscience --add-data "desktop/ark_omniscience/data;data" --collect-all PySide6 desktop/main.py
```

## What's in here

| Part | Stack | Purpose |
|---|---|---|
| `src/` | Next.js 16, React 19, Drizzle ORM, PostgreSQL | Web command centre: 15 sections (agents, creatures, combinations, buffs, raid, PvP, PvE, breeding, mechanics, experiments, discoveries, sources, reports, settings) |
| `src/lib/ark/` | TypeScript | Curated knowledge base: 85 creatures, 61 buffs, boss records |
| `src/lib/engines/` | TypeScript | Synergy, hypothesis and experiment engines (deterministic, hash-stable) |
| `src/lib/agents/` | TypeScript | 12 research agents; agents never self-validate findings |
| `desktop/` | Python 3.12, PySide6 | Windows desktop client; thin GUI over `ark_omniscience/core.py` (fully testable headlessly) |
| `desktop/ark_omniscience/data/knowledge_base.json` | JSON | Embedded KB snapshot, regenerated with `npx tsx scripts/export-knowledge-base.ts` |
| `tests/` + `desktop/tests/` | node:test, pytest | 19 engine tests + 13 desktop core tests, all passing |

## Research integrity

- Profile scores (0–100) are analyst ratings, **not in-game numbers**.
- Only documented numeric multipliers are applied; nothing is invented.
- Designed experiments never contain results; confirmation requires measured replicates + evidence.
- Classifications run from `UNVERIFIED` → `INDEPENDENTLY-REPLICATED`, and `PATCHED / OBSOLETE` is tracked separately.

## Screenshots

| Screen | Image |
|---|---|
| Command Centre | [01](docs/screenshots/01-command-centre.png) |
| Creature Encyclopedia | [02](docs/screenshots/02-creature-encyclopedia.png) |
| Buff Lab | [03](docs/screenshots/03-buff-lab.png) |
| PvE & Boss | [04](docs/screenshots/04-pve-boss.png) |
| Discovery Database | [05](docs/screenshots/05-discovery-database.png) |
| Settings | [06](docs/screenshots/06-settings.png) |

Captured from the real application running in offline mode (`python scripts/capture_screenshots.py`).

## Tests

```powershell
npx tsx --test tests/ark.test.ts          # 19 passing
python -m pytest desktop/tests/test_core.py -v   # 13 passing
npm run build                              # Next.js production build
```

## Docs

- [Architecture](docs/architecture.md)
- [Web platform setup](docs/installation.md)
- [Desktop build](docs/desktop-build.md)
- [Troubleshooting](docs/troubleshooting.md)

## License

No license file is included yet — all rights reserved by default. See the repository owner for terms.
On GitHub, the repository owner can add a license under **Settings → General → License**.
