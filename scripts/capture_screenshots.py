import os, sys
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
sys.path.insert(0, "desktop")
from PySide6 import QtWidgets
from ark_omniscience.app import ArkOmniscienceWindow, APP_NAME, APP_VERSION
from ark_omniscience.core import Config, ApiClient, Repository, EmbeddedRepository

app = QtWidgets.QApplication.instance() or QtWidgets.QApplication(sys.argv)
app.setApplicationName(APP_NAME)
win = ArkOmniscienceWindow()
win.show()
win.refresh()
app.processEvents()
out = "docs/screenshots"
os.makedirs(out, exist_ok=True)

names = [
    "01-command-centre",
    "02-agent-control",
    "03-creature-encyclopedia",
    "04-combination-explorer",
    "05-buff-lab",
    "06-raid-intelligence",
    "07-pvp-research",
    "08-pve-boss",
    "09-breeding-mutation",
    "10-undiscovered-mechanics",
    "11-experiment-manager",
    "12-discovery-database",
    "13-evidence-sources",
    "14-research-reports",
    "15-settings",
]

def shot(tab_idx, name):
    win.tabs.setCurrentIndex(tab_idx)
    app.processEvents()
    QtWidgets.QApplication.processEvents()
    pix = win.grab()
    ok = pix.save(f"{out}/{name}.png")
    print(name, ok, pix.size().width(), "x", pix.size().height())

for i, n in enumerate(names):
    shot(i, n)

emb = EmbeddedRepository()
print("creatures", len(emb.creatures()), "buffs", len(emb.buffs()))