# ARK Omniscience — Desktop Research Client (PySide6)

A native desktop front-end for the ARK Omniscience research platform. It reads the
same PostgreSQL-backed research database through the platform's REST API and can
also work fully offline from a JSON export (`/api/export`).

## Install

```bash
cd desktop
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

## Configuration

Stored in `~/.ark_omniscience/ark_omniscience.json` (override the directory with
`ARK_OMNI_CONFIG_DIR`):

| Key | Meaning |
| --- | --- |
| `base_url` | Platform base URL (default `http://127.0.0.1:3000`) |
| `offline_export` | Path to a JSON export used when the API is unreachable |
| `timeout_seconds` | HTTP timeout |
| `theme` | Reserved for additional themes (default `tactical-dark`) |

You can also set `ARK_OMNI_BASE_URL` in the environment.

## Sections

Command Centre · Research Agent Control · Creature Encyclopedia · Combination
Explorer · Buff Interaction Laboratory · Raid Intelligence · PvP Research ·
PvE & Boss Research · Breeding & Mutation Laboratory · Undiscovered Mechanics ·
Experiment Manager · Discovery Database · Evidence & Sources · Research Reports ·
Settings.

## Headless use

`ark_omniscience.core` has no GUI dependencies, so the same client can be used in
scripts and scheduled research campaigns:

```python
from ark_omniscience import ApiClient, Config, Repository

client = ApiClient(Config(base_url="http://localhost:3000"))
repo = Repository(client, Config())
client.run_cycle()                     # run a full research campaign
repo.record_results("EXP-0001", [{"metric": "damage-per-swing", "baseline": 100, "experimental": 152}], 3, "notes")
```

## Windows executable

```bash
pip install pyinstaller
pyinstaller --noconfirm --windowed --name "ARKOmniscience" main.py
```

The build appears in `desktop/dist/ARKOmniscience/`. Ship it with the platform's
`DATABASE_URL` or point the client at a running server.

## Tests

```bash
python -m unittest discover -s tests -v
```
