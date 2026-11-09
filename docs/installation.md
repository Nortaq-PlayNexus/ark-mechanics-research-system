# Installation

## Desktop app (recommended for most users)

Download a release ZIP, extract anywhere, run `ArkOmniscience.exe`. No Python, Node or database needed. Creature/Buff/Boss tabs work offline from the embedded knowledge base.

## Web platform (development)

Requirements: Node.js 22+, PostgreSQL 14+.

```powershell
npm install
$env:DATABASE_URL = "postgres://user:pass@localhost:5432/ark_omniscience"
npm run dev
```

Seed the database (if desired):

```powershell
npx tsx -e "import('./src/lib/db/seed.ts').then(async m => { await m.ensureSeeded(); process.exit(0); })"
```

For production:

```powershell
npm run build
npm run start
```

## Desktop from source

```powershell
pip install -r desktop/requirements.txt
python desktop/main.py
```

Set the platform URL in the Settings tab (default `http://127.0.0.1:3000`). Config is stored in `~/.ark_omniscience/ark_omniscience.json`.
