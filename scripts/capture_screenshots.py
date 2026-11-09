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
import pathlib
pathlib.Path(out).mkdir(parents=True, exist_ok=True)
def shot(tab_idx, name):
    win.tabs.setCurrentIndex(tab_idx)
    app.processEvents()
    pix = win.grab()
    ok = pix.save(f"{out}/{name}.png")
    print(name, ok, pix.size().width(), pix.size().height())
shot(0, "01-command-centre")
shot(2, "02-creature-encyclopedia")
shot(4, "03-buff-lab")
shot(7, "04-pve-boss")
shot(12, "05-discovery-database")
shot(14, "06-settings")
# verify offline counts
emb = EmbeddedRepository()
print("creatures", len(emb.creatures()))
