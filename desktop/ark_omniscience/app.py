"""ARK Omniscience — PySide6 desktop research platform.

Fifteen sections mirroring the web command centre:

1 Command Centre · 2 Research Agent Control · 3 Creature Encyclopedia ·
4 Creature Combination Explorer · 5 Buff Interaction Laboratory ·
6 Raid Intelligence · 7 PvP Research · 8 PvE & Boss Research ·
9 Breeding & Mutation Laboratory · 10 Undiscovered Mechanics ·
11 Experiment Manager · 12 Discovery Database · 13 Evidence & Sources ·
14 Research Reports · 15 Settings

The GUI is deliberately thin: every piece of logic lives in :mod:`core` so it can
be tested without a display server.
"""

from __future__ import annotations

import sys
from typing import Any

try:  # pragma: no cover - PySide6 is an optional runtime dependency
    from PySide6 import QtCore, QtWidgets
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "PySide6 is required for the desktop application.\n"
        "Install it with:  pip install -r desktop/requirements.txt"
    ) from exc

from .core import (
    APP_NAME,
    APP_VERSION,
    ApiClient,
    ApiError,
    Config,
    Repository,
    awaiting_manual_testing,
    rank_creatures,
    rank_discoveries,
    summary_lines,
)

STYLE = """
QWidget { background-color: #05070a; color: #d6e2df; font-size: 13px; }
QLabel#kicker { color: #35e08a; font-size: 10px; letter-spacing: 3px; }
QLabel#title { color: #ffffff; font-size: 20px; font-weight: 600; }
QLabel#amber { color: #ffb428; }
QListWidget, QTreeWidget, QTableWidget { background-color: #0a0f14; border: 1px solid #1b2b32; }
QHeaderView::section { background-color: #0e161d; color: #35e08a; border: 0; padding: 4px; }
QPushButton { background-color: #0e161d; border: 1px solid #1b2b32; color: #d6e2df; padding: 6px 12px; }
QPushButton:hover { border-color: #35e08a; color: #35e08a; }
QPushButton:disabled { color: #4a5a5f; }
QTabWidget::pane { border: 1px solid #1b2b32; }
QTabBar::tab { background: #0a0f14; color: #7d8f8a; padding: 8px 12px; }
QTabBar::tab:selected { color: #35e08a; border-bottom: 2px solid #35e08a; }
QTextEdit, QPlainTextEdit, QLineEdit, QComboBox { background-color: #0a0f14; border: 1px solid #1b2b32; color: #d6e2df; }
QStatusBar { color: #7d8f8a; }
"""


class DataWidget(QtWidgets.QTreeWidget):
    """Generic two/three column record list."""

    def __init__(self, headers: list[str], parent: QtWidgets.QWidget | None = None) -> None:
        super().__init__(parent)
        self.setColumnCount(len(headers))
        self.setHeaderLabels(headers)
        self.setAlternatingRowColors(True)
        self.setRootIsDecorated(False)

    def fill(self, rows: list[list[str]]) -> None:
        self.clear()
        for row in rows:
            item = QtWidgets.QTreeWidgetItem([str(cell) for cell in row])
            self.addTopLevelItem(item)
        for i in range(self.columnCount()):
            self.resizeColumnToContents(i)


class ArkOmniscienceWindow(QtWidgets.QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.config = Config().load()
        self.client = ApiClient(self.config)
        self.repo = Repository(self.client, self.config)
        self.setWindowTitle(f"{APP_NAME} — Autonomous Research Division v{APP_VERSION}")
        self.resize(1400, 900)
        self.setStyleSheet(STYLE)

        self.tabs = QtWidgets.QTabWidget()
        self.setCentralWidget(self.tabs)
        self.status = self.statusBar()
        self.status.showMessage("Connecting to research platform…")

        self._build_command_centre()
        self._build_agent_control()
        self._build_creatures()
        self._build_combination_explorer()
        self._build_buff_lab()
        self._build_section_list("Raid Intelligence", ["Formation", "Score", "Party", "Detail"], "/api/combinations", "context", "raid-assault")
        self._build_section_list("PvP Research", ["Composition", "Score", "Party", "Detail"], "/api/combinations", "context", "pvp-open")
        self._build_pve()
        self._build_breeding()
        self._build_mechanics()
        self._build_experiments()
        self._build_discoveries()
        self._build_sources()
        self._build_reports()
        self._build_settings()

        QtCore.QTimer.singleShot(200, self.refresh)

    # ---------------------------------------------------------------- helpers

    def _header(self, kicker: str, title: str) -> QtWidgets.QWidget:
        page = QtWidgets.QWidget()
        layout = QtWidgets.QVBoxLayout(page)
        k = QtWidgets.QLabel(kicker.upper())
        k.setObjectName("kicker")
        t = QtWidgets.QLabel(title)
        t.setObjectName("title")
        layout.addWidget(k)
        layout.addWidget(t)
        return page, layout

    def _safe(self, fn: Any, *args: Any, **kwargs: Any) -> Any:
        try:
            return fn(*args, **kwargs)
        except ApiError as exc:
            self.status.showMessage(str(exc))
            return None

    # --------------------------------------------------------------- sections

    def _build_command_centre(self) -> None:
        page, layout = self._header("Section 00", "Command Centre")
        self.cmd_output = QtWidgets.QPlainTextEdit()
        self.cmd_output.setReadOnly(True)
        layout.addWidget(self.cmd_output)
        buttons = QtWidgets.QHBoxLayout()
        for label, handler in (
            ("Refresh status", self.refresh),
            ("Run research cycle", self.run_cycle),
            ("Regenerate reports", self.regenerate_reports),
        ):
            btn = QtWidgets.QPushButton(label)
            btn.clicked.connect(handler)
            buttons.addWidget(btn)
        buttons.addStretch(1)
        layout.addLayout(buttons)
        self.tabs.addTab(page, "Command Centre")

    def _build_agent_control(self) -> None:
        page, layout = self._header("Section 01", "Research Agent Control")
        self.agent_table = DataWidget(["Agent", "Role", "Domain", "Status", "Findings", "Tasks"])
        layout.addWidget(self.agent_table)
        self.agent_log = QtWidgets.QPlainTextEdit()
        self.agent_log.setReadOnly(True)
        layout.addWidget(self.agent_log)
        row = QtWidgets.QHBoxLayout()
        self.agent_combo = QtWidgets.QComboBox()
        row.addWidget(self.agent_combo)
        run_btn = QtWidgets.QPushButton("Run research pass")
        run_btn.clicked.connect(self.run_agent)
        row.addWidget(run_btn)
        task_edit = QtWidgets.QLineEdit()
        task_edit.setPlaceholderText("Assign a new research task…")
        self.task_edit = task_edit
        row.addWidget(task_edit)
        queue_btn = QtWidgets.QPushButton("Queue task")
        queue_btn.clicked.connect(self.queue_task)
        row.addWidget(queue_btn)
        layout.addLayout(row)
        self.tabs.addTab(page, "Agent Control")

    def _build_creatures(self) -> None:
        page, layout = self._header("Section 02", "Creature Encyclopedia")
        self.creature_table = DataWidget(["Creature", "Species", "Tier", "Damage", "Mitigation", "Utility", "Control", "Confidence"])
        layout.addWidget(self.creature_table)
        self.creature_notes = QtWidgets.QPlainTextEdit()
        self.creature_notes.setReadOnly(True)
        layout.addWidget(self.creature_notes)
        self.creature_table.itemSelectionChanged.connect(self.show_creature_notes)
        self.tabs.addTab(page, "Creatures")

    def _build_combination_explorer(self) -> None:
        page, layout = self._header("Section 03", "Combination Explorer")
        row = QtWidgets.QHBoxLayout()
        self.combo_list = QtWidgets.QListWidget()
        self.combo_list.setSelectionMode(QtWidgets.QAbstractItemView.SelectionMode.MultiSelection)
        row.addWidget(self.combo_list, 2)
        self.context_combo = QtWidgets.QComboBox()
        for ctx in ["raid-assault", "raid-defence", "boss-arena", "pvp-open", "pve-general", "logistics"]:
            self.context_combo.addItem(ctx)
        analyse_btn = QtWidgets.QPushButton("Analyse combination")
        analyse_btn.clicked.connect(self.analyse_combination)
        side = QtWidgets.QVBoxLayout()
        side.addWidget(self.context_combo)
        side.addWidget(analyse_btn)
        side.addStretch(1)
        row.addLayout(side, 1)
        layout.addLayout(row)
        self.combo_output = QtWidgets.QPlainTextEdit()
        self.combo_output.setReadOnly(True)
        layout.addWidget(self.combo_output)
        self.tabs.addTab(page, "Combinations")

    def _build_buff_lab(self) -> None:
        page, layout = self._header("Section 04", "Buff Interaction Laboratory")
        self.buff_table = DataWidget(["Effect", "Kind", "Category", "Scope", "Stacking", "Confidence"])
        layout.addWidget(self.buff_table)
        self.buff_notes = QtWidgets.QPlainTextEdit()
        self.buff_notes.setReadOnly(True)
        layout.addWidget(self.buff_notes)
        self.buff_table.itemSelectionChanged.connect(self.show_buff_notes)
        self.tabs.addTab(page, "Buff Lab")

    def _build_section_list(self, title: str, headers: list[str], endpoint: str, param: str, value: str) -> None:
        page, layout = self._header(title, title)
        table = DataWidget(headers)
        layout.addWidget(table)
        detail = QtWidgets.QPlainTextEdit()
        detail.setReadOnly(True)
        layout.addWidget(detail)
        table.itemSelectionChanged.connect(lambda: self.show_generic_detail(table, detail))
        self._section_tables = getattr(self, "_section_tables", {})
        self._section_tables[title] = (endpoint, {param: value}, table)
        self.tabs.addTab(page, title)

    def _build_pve(self) -> None:
        page, layout = self._header("Boss Research", "PvE & Boss Research")
        self.boss_table = DataWidget(["Boss", "Arena", "Difficulty", "Recommended"])
        layout.addWidget(self.boss_table)
        self.boss_detail = QtWidgets.QPlainTextEdit()
        self.boss_detail.setReadOnly(True)
        layout.addWidget(self.boss_detail)
        self.boss_table.itemSelectionChanged.connect(self.show_boss_detail)
        self.tabs.addTab(page, "PvE & Boss")

    def _build_breeding(self) -> None:
        page, layout = self._header("Breeding Laboratory", "Breeding & Mutation Research")
        self.breeding_table = DataWidget(["Programme", "Species", "Role", "Stat priority", "Generations", "Confidence"])
        layout.addWidget(self.breeding_table)
        self.tabs.addTab(page, "Breeding")

    def _build_mechanics(self) -> None:
        page, layout = self._header("Undiscovered Mechanics", "Hypothesis Engine")
        self.mechanics_table = DataWidget(["Code", "Question", "Domain", "Priority", "Confidence"])
        layout.addWidget(self.mechanics_table)
        self.tabs.addTab(page, "Mechanics")

    def _build_experiments(self) -> None:
        page, layout = self._header("Experiment Manager", "Experimental Laboratory")
        self.experiment_table = DataWidget(["Code", "Status", "Classification", "Confidence", "Title"])
        layout.addWidget(self.experiment_table)
        self.experiment_detail = QtWidgets.QPlainTextEdit()
        self.experiment_detail.setReadOnly(True)
        layout.addWidget(self.experiment_detail)
        self.experiment_table.itemSelectionChanged.connect(self.show_experiment_detail)
        self.tabs.addTab(page, "Experiments")

    def _build_discoveries(self) -> None:
        page, layout = self._header("Discovery Database", "Classified Findings")
        self.discovery_table = DataWidget(["Code", "Classification", "Confidence", "Agent", "Title"])
        layout.addWidget(self.discovery_table)
        self.discovery_detail = QtWidgets.QPlainTextEdit()
        self.discovery_detail.setReadOnly(True)
        layout.addWidget(self.discovery_detail)
        self.discovery_table.itemSelectionChanged.connect(self.show_discovery_detail)
        self.tabs.addTab(page, "Discoveries")

    def _build_sources(self) -> None:
        page, layout = self._header("Evidence & Sources", "Source Registry")
        self.source_table = DataWidget(["Key", "Title", "Publisher", "Type", "Reliability", "Version"])
        layout.addWidget(self.source_table)
        self.tabs.addTab(page, "Sources")

    def _build_reports(self) -> None:
        page, layout = self._header("Research Reports", "Automated Reports")
        self.report_table = DataWidget(["Code", "Title", "Kind", "Generated"])
        layout.addWidget(self.report_table)
        self.report_detail = QtWidgets.QPlainTextEdit()
        self.report_detail.setReadOnly(True)
        layout.addWidget(self.report_detail)
        self.report_table.itemSelectionChanged.connect(self.show_report_detail)
        self.tabs.addTab(page, "Reports")

    def _build_settings(self) -> None:
        page, layout = self._header("Settings", "Configuration & Data")
        form = QtWidgets.QFormLayout()
        self.base_url_edit = QtWidgets.QLineEdit(self.config.base_url)
        self.export_edit = QtWidgets.QLineEdit(self.config.offline_export)
        form.addRow("Platform base URL", self.base_url_edit)
        form.addRow("Offline export path", self.export_edit)
        layout.addLayout(form)
        buttons = QtWidgets.QHBoxLayout()
        save_btn = QtWidgets.QPushButton("Save configuration")
        save_btn.clicked.connect(self.save_config)
        export_btn = QtWidgets.QPushButton("Open offline export")
        export_btn.clicked.connect(self.load_offline_export)
        buttons.addWidget(save_btn)
        buttons.addWidget(export_btn)
        buttons.addStretch(1)
        layout.addLayout(buttons)
        self.settings_output = QtWidgets.QPlainTextEdit()
        self.settings_output.setReadOnly(True)
        layout.addWidget(self.settings_output)
        self.tabs.addTab(page, "Settings")

    # ----------------------------------------------------------------- actions

    def refresh(self) -> None:
        state = self._safe(self.client.state)
        if state is None:
            self._load_creatures()
            self._load_buffs()
            self._load_pve()
            self.cmd_output.setPlainText(
                "Platform unreachable — offline mode. Creature, buff and boss data loaded from the bundled knowledge base. Agent runs, research cycles and live reports need the web platform (npm run build && npm run start). See Settings for the offline export option."
            )
            return
        self.cmd_output.setPlainText("\n".join(summary_lines(state)))
        agents = state.get("agents", [])
        self.agent_table.fill(
            [
                [
                    a.get("code", ""),
                    a.get("name", ""),
                    a.get("domain", ""),
                    a.get("status", ""),
                    str(a.get("findingsCount", 0)),
                    str(a.get("tasksCompleted", 0)),
                ]
                for a in agents
            ]
        )
        self.agent_combo.clear()
        for a in agents:
            self.agent_combo.addItem(f"{a.get('code')} — {a.get('name')}", a.get("code"))
        logs = "\n".join(
            f"{entry.get('agentCode')}: {entry.get('message')}" for entry in reversed(state.get("logs", []))
        )
        self.agent_log.setPlainText(logs)

        self._load_creatures()
        self._load_buffs()
        self._load_pve()
        self._load_breeding()
        self._load_mechanics()
        self._load_experiments()
        self._load_discoveries()
        self._load_sources()
        self._load_reports()
        for title, (endpoint, params, table) in getattr(self, "_section_tables", {}).items():
            payload = self._safe(self.client.get, endpoint, params)
            if not payload:
                continue
            rows = payload.get("combinations", [])
            table.fill(
                [
                    [
                        " + ".join(rows_item.get("memberSlugs", [])[:4]),
                        str(rows_item.get("synergyScore", 0)),
                        str((rows_item.get("analysis") or {}).get("partyScore", "")),
                        (rows_item.get("rationale") or "")[:220],
                    ]
                    for rows_item in rows[:40]
                ]
            )
        self.status.showMessage(f"Connected to {self.config.base_url}")

    def _load_creatures(self) -> None:
        creatures = self._safe(self.repo.creatures)
        if not creatures:
            return
        self._creatures = creatures
        self.creature_table.fill(
            [
                [
                    c.name,
                    c.species,
                    c.tier,
                    str(c.profile.get("damage", 0)),
                    str(c.profile.get("mitigation", 0)),
                    str(c.profile.get("utility", 0)),
                    str(c.profile.get("cc", 0)),
                    c.confidence,
                ]
                for c in rank_creatures(creatures, "utility")
            ]
        )
        self.combo_list.clear()
        for c in creatures:
            self.combo_list.addItem(c.name)

    def _load_buffs(self) -> None:
        buffs = self._safe(self.repo.buffs)
        self._buffs = buffs or []
        self.buff_table.fill(
            [
                [
                    b.get("name", ""),
                    b.get("kind", ""),
                    b.get("category", ""),
                    b.get("scope", ""),
                    b.get("stacking", ""),
                    b.get("confidence", ""),
                ]
                for b in self._buffs
            ]
        )

    def _load_pve(self) -> None:
        payload = self._safe(self.client.get, "/api/state")
        self._bosses = []
        if payload:
            self._bosses = payload.get("bosses", []) if isinstance(payload.get("bosses"), list) else []
        if not self._bosses:
            try:
                self._bosses = self.repo.embedded().bosses()
            except Exception:
                self._bosses = []
        if not self._bosses:
            self.boss_table.fill([["No boss data loaded", "", "", ""]])
            return
        self.boss_table.fill(
            [
                [b.get("name", ""), b.get("arena", ""), b.get("difficulty", ""), ", ".join(b.get("recommendedSlugs", [])[:5])]
                for b in self._bosses
            ]
        )

    def _load_breeding(self) -> None:
        export = self._safe(self.repo.load_export) if self.config.offline_export else None
        programmes = (export or {}).get("data", {}).get("breedingPrograms", []) if export else []
        self.breeding_table.fill(
            [
                [
                    p.get("slug", ""),
                    p.get("species", ""),
                    p.get("role", ""),
                    " > ".join(p.get("statPriorities", [])),
                    str(p.get("generations", 0)),
                    p.get("confidence", ""),
                ]
                for p in programmes
            ]
            or [["Load an offline export to view breeding programmes", "", "", "", "", ""]]
        )

    def _load_mechanics(self) -> None:
        payload = self._safe(self.client.get, "/api/research", {"type": "hypotheses", "limit": "300"})
        rows = payload.get("hypotheses", []) if payload else []
        self.mechanics_table.fill(
            [
                [h.get("code", ""), h.get("question", "")[:150], h.get("domain", ""), str(h.get("priority", 0)), str(h.get("confidence", 0))]
                for h in rows[:200]
            ]
        )

    def _load_experiments(self) -> None:
        experiments = self._safe(self.repo.experiments)
        self._experiments = experiments or []
        self.experiment_table.fill(
            [
                [e.code, e.status, e.classification, str(e.confidence), e.title[:110]]
                for e in awaiting_manual_testing(self._experiments) + [e for e in self._experiments if e.status != "pending-manual-testing"]
            ]
        )

    def _load_discoveries(self) -> None:
        discoveries = self._safe(self.repo.discoveries)
        self._discoveries = discoveries or []
        self.discovery_table.fill(
            [[d.code, d.classification, str(d.confidence_score), d.found_by, d.title[:110]] for d in rank_discoveries(self._discoveries)]
        )

    def _load_sources(self) -> None:
        export = self._safe(self.repo.load_export) if self.config.offline_export else None
        rows = (export or {}).get("data", {}).get("sources", []) if export else []
        self.source_table.fill(
            [[s.get("key", ""), s.get("title", ""), s.get("publisher", ""), s.get("sourceType", ""), str(s.get("reliability", 0)), s.get("versionTag", "")] for s in rows]
            or [["Load an offline export to view the source registry", "", "", "", "", ""]]
        )

    def _load_reports(self) -> None:
        reports = self._safe(self.repo.reports)
        self._reports = reports or []
        self.report_table.fill(
            [[r.get("code", ""), r.get("title", ""), r.get("kind", ""), str(r.get("createdAt", ""))[:19]] for r in self._reports]
        )

    # -------------------------------------------------------------- selection

    def show_creature_notes(self) -> None:
        item = self.creature_table.currentItem()
        if not item:
            return
        name = item.text(0)
        for c in getattr(self, "_creatures", []):
            if c.name == name:
                self.creature_notes.setPlainText(f"{c.name} ({c.species})\n\n{c.notes}\n\nRoles: {', '.join(c.roles)}\nConfidence: {c.confidence}")
                return

    def show_buff_notes(self) -> None:
        item = self.buff_table.currentItem()
        if not item:
            return
        for b in getattr(self, "_buffs", []):
            if b.get("name") == item.text(0):
                effects = "\n".join(
                    f"  {e.get('stat')}: {e.get('mode')} {e.get('value')}" for e in b.get("effects", [])
                )
                self.buff_notes.setPlainText(f"{b.get('name')}\n\n{b.get('notes')}\n\nEffects:\n{effects}\n\nProviders: {', '.join(b.get('providers', []))}")
                return

    def show_generic_detail(self, table: DataWidget, output: QtWidgets.QPlainTextEdit) -> None:
        item = table.currentItem()
        if item:
            output.setPlainText(item.text(table.columnCount() - 1))

    def show_boss_detail(self) -> None:
        item = self.boss_table.currentItem()
        if not item:
            return
        for b in getattr(self, "_bosses", []):
            if b.get("name") == item.text(0):
                self.boss_detail.setPlainText(
                    f"{b.get('name')}\n{b.get('arena')}\n\nRestrictions: {', '.join(b.get('restrictions', []))}\n\n{b.get('notes')}"
                )
                return

    def show_experiment_detail(self) -> None:
        item = self.experiment_table.currentItem()
        if not item:
            return
        for e in getattr(self, "_experiments", []):
            if e.code == item.text(0):
                self.experiment_detail.setPlainText(
                    f"{e.code} — {e.title}\nStatus: {e.status} · Classification: {e.classification} · Confidence: {e.confidence}\n\n"
                    + "Procedure:\n"
                    + "\n".join(f"  {i + 1}. {step}" for i, step in enumerate(e.procedure))
                    + "\n\nLimitations:\n"
                    + "\n".join(f"  • {line}" for line in e.limitations if line)
                )
                return

    def show_discovery_detail(self) -> None:
        item = self.discovery_table.currentItem()
        if not item:
            return
        for d in getattr(self, "_discoveries", []):
            if d.code == item.text(0):
                self.discovery_detail.setPlainText(
                    f"{d.code} — {d.title}\n{d.classification} · confidence {d.confidence_score} · found by {d.found_by}\n\n{d.summary}"
                )
                return

    def show_report_detail(self) -> None:
        item = self.report_table.currentItem()
        if not item:
            return
        for r in getattr(self, "_reports", []):
            if r.get("code") == item.text(0):
                body = r.get("body") or {}
                narrative = "\n".join(f"• {n}" for n in body.get("narrative", []))
                sections = "\n\n".join(
                    f"{s.get('heading')}\n" + "\n".join(f"  - {row.get('label')}: {row.get('value')}" for row in s.get("rows", [])[:12])
                    for s in body.get("sections", [])
                )
                self.report_detail.setPlainText(
                    f"{r.get('title')}\n\nMETHODOLOGY\n{r.get('methodology')}\n\nFINDINGS\n{narrative}\n\n{sections}\n\nLIMITATIONS\n{r.get('limitations')}"
                )
                return

    # ---------------------------------------------------------------- commands

    def run_cycle(self) -> None:
        result = self._safe(self.client.run_cycle)
        if result:
            self.status.showMessage(f"Research cycle complete: {result.get('discoveriesCreated', 0)} discoveries, {result.get('experimentsCreated', 0)} experiments")
            self.refresh()

    def regenerate_reports(self) -> None:
        result = self._safe(self.client.post, "/api/reports", {})
        if result:
            self.status.showMessage("Reports regenerated")
            self._load_reports()

    def run_agent(self) -> None:
        code = self.agent_combo.currentData()
        if not code:
            return
        result = self._safe(self.client.run_agent, code)
        if result and result.get("result"):
            findings = result["result"].get("findings", [])
            self.status.showMessage(f"{code} produced {len(findings)} findings")
            self.refresh()

    def queue_task(self) -> None:
        title = self.task_edit.text().strip()
        code = self.agent_combo.currentData()
        if not title or not code:
            return
        result = self._safe(self.client.post, "/api/tasks", {"agentCode": code, "title": title, "question": "Operator-directed investigation"})
        if result:
            self.status.showMessage(f"Task {result.get('code', '')} queued for {code}")
            self.task_edit.clear()

    def analyse_combination(self) -> None:
        slugs = [item.text() for item in self.combo_list.selectedItems()]
        if len(slugs) < 2:
            self.combo_output.setPlainText("Select at least two creatures.")
            return
        name_to_slug = {c.name: c.slug for c in getattr(self, "_creatures", [])}
        payload = self._safe(
            self.client.analyse_combination, [name_to_slug.get(n, n) for n in slugs], self.context_combo.currentText()
        )
        if not payload:
            return
        metrics = "\n".join(f"  {k}: {v}" for k, v in payload.get("metrics", {}).items())
        coverage = "\n".join(f"  {'✔' if c.get('covered') else '✘'} {c.get('role')}" for c in payload.get("supportCoverage", []))
        conflicts = "\n".join(f"  ! {c.get('title')}: {c.get('detail')}" for c in payload.get("conflicts", []))
        self.combo_output.setPlainText(
            f"{', '.join(slugs)}\nContext: {payload.get('context')}\n\n"
            f"Party score: {payload.get('partyScore')} (best single {payload.get('bestSingleScore')})\n"
            f"Synergy score: {payload.get('synergyScore')} (delta {payload.get('synergyDelta')})\n"
            f"Documented damage multiplier: x{payload.get('estimatedDamageMultiplier')}\n"
            f"Additive resistance: {round(float(payload.get('estimatedMitigation', 0)) * 100)}%\n\n"
            f"METRICS\n{metrics}\n\nSUPPORT COVERAGE\n{coverage}\n\nCONFLICTS\n{conflicts or '  none detected'}\n\n"
            f"RATIONALE\n{payload.get('rationale')}\n\nASSUMPTIONS\n"
            + "\n".join(f"  • {a}" for a in payload.get("assumptions", []))
        )

    def save_config(self) -> None:
        self.config.base_url = self.base_url_edit.text().rstrip("/")
        self.config.offline_export = self.export_edit.text().strip()
        self.config.save()
        self.client = ApiClient(self.config)
        self.repo = Repository(self.client, self.config)
        self.settings_output.setPlainText(f"Configuration saved to {self.config.path}\n\n{self.config.to_dict()}")
        self.status.showMessage("Configuration saved")

    def load_offline_export(self) -> None:
        path, _ = QtWidgets.QFileDialog.getOpenFileName(self, "Open offline export", "", "JSON (*.json)")
        if not path:
            return
        self.config.offline_export = path
        self.export_edit.setText(path)
        self.config.save()
        try:
            export = self.repo.load_export(path)
        except Exception as exc:  # pragma: no cover
            self.settings_output.setPlainText(f"Failed to load export: {exc}")
            return
        counts = export.get("counts", {})
        data = export.get("data", {})
        self.settings_output.setPlainText(
            "Offline export loaded.\n\n"
            + "\n".join(f"  {key}: {value}" for key, value in counts.items())
            + f"\n\nTables available: {', '.join(data.keys())}"
        )
        self._creatures = []
        rows = data.get("creatures", [])
        self.creature_table.fill(
            [[r.get("name", ""), r.get("species", ""), r.get("tier", ""), "", "", "", "", r.get("confidence", "")] for r in rows]
        )
        self.breeding_table.fill(
            [
                [p.get("slug", ""), p.get("species", ""), p.get("role", ""), " > ".join(p.get("statPriorities", [])), str(p.get("generations", 0)), p.get("confidence", "")]
                for p in data.get("breedingPrograms", [])
            ]
        )
        self.source_table.fill(
            [
                [s.get("key", ""), s.get("title", ""), s.get("publisher", ""), s.get("sourceType", ""), str(s.get("reliability", 0)), s.get("versionTag", "")]
                for s in data.get("sources", [])
            ]
        )


def main(argv: list[str] | None = None) -> int:
    app = QtWidgets.QApplication(argv if argv is not None else sys.argv)
    app.setApplicationName(APP_NAME)
    app.setApplicationVersion(APP_VERSION)
    window = ArkOmniscienceWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
