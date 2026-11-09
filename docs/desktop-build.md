# Desktop build

The desktop app is a PySide6 application packaged with PyInstaller.

```powershell
pip install -r desktop/requirements.txt
pip install pyinstaller

# Regenerate the embedded knowledge base if src/lib/ark changed
npx tsx scripts/export-knowledge-base.ts

pyinstaller --noconfirm --windowed --name ArkOmniscience `
  --add-data "desktop/ark_omniscience/data;data" `
  --collect-all PySide6 desktop/main.py
```

Output: `dist/ArkOmniscience/ArkOmniscience.exe` (folder build; zip the folder for distribution).

Verification: launch the EXE, confirm it stays running, and that the Creature Encyclopedia shows 85 rows, Buff Lab 61, PvE & Boss 8.
