"""ARK Omniscience — desktop client core.

This module contains all non-GUI logic so it can be tested and used headlessly:

* :class:`Config`      — persisted configuration (API base URL, offline export path).
* :class:`ApiClient`   — thin HTTP client for the platform's REST API.
* :class:`Repository`  — normalises API responses into typed records and can work
                          fully offline from a JSON export produced by ``/api/export``.
* :func:`rank`         — shared ranking helpers used by every desktop view.

The desktop application is a research client on top of the same database the web
command centre uses; it never fabricates results and displays every classification
exactly as the platform recorded it.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

APP_NAME = "ARK Omniscience"
APP_VERSION = "1.0.0"
DEFAULT_BASE_URL = os.environ.get("ARK_OMNI_BASE_URL", "http://127.0.0.1:3000")
CONFIG_FILENAME = "ark_omniscience.json"

CLASSIFICATION_ORDER: dict[str, int] = {
    "UNVERIFIED": 0,
    "SOURCE-SUPPORTED": 1,
    "PARTIALLY-VALIDATED": 2,
    "EXPERIMENTALLY-CONFIRMED": 3,
    "INDEPENDENTLY-REPLICATED": 4,
    "PATCHED / OBSOLETE": -1,
}


class ArkOmniscienceError(RuntimeError):
    """Base error for the desktop client."""


class ApiError(ArkOmniscienceError):
    """Raised when the platform API cannot be reached or returns an error."""


# --------------------------------------------------------------------- config


@dataclass
class Config:
    base_url: str = DEFAULT_BASE_URL
    offline_export: str = ""
    timeout_seconds: float = 15.0
    theme: str = "tactical-dark"

    def to_dict(self) -> dict[str, Any]:
        return {
            "base_url": self.base_url,
            "offline_export": self.offline_export,
            "timeout_seconds": self.timeout_seconds,
            "theme": self.theme,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Config":
        cfg = cls()
        cfg.base_url = str(data.get("base_url", DEFAULT_BASE_URL)).rstrip("/")
        cfg.offline_export = str(data.get("offline_export", ""))
        try:
            cfg.timeout_seconds = float(data.get("timeout_seconds", 15.0))
        except (TypeError, ValueError):
            cfg.timeout_seconds = 15.0
        cfg.theme = str(data.get("theme", "tactical-dark"))
        return cfg

    @property
    def path(self) -> Path:
        return config_path()

    def save(self) -> None:
        self.path.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")

    def load(self) -> "Config":
        if self.path.exists():
            try:
                return Config.from_dict(json.loads(self.path.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                return self
        return self


def config_dir() -> Path:
    override = os.environ.get("ARK_OMNI_CONFIG_DIR")
    if override:
        return Path(override)
    home = Path.home() / ".ark_omniscience"
    home.mkdir(parents=True, exist_ok=True)
    return home


def config_path() -> Path:
    return config_dir() / CONFIG_FILENAME


# ------------------------------------------------------------------ api client


class ApiClient:
    """Minimal JSON HTTP client. Uses only the standard library."""

    def __init__(self, config: Config) -> None:
        self.config = config

    def _url(self, path: str) -> str:
        if not path.startswith("/"):
            path = "/" + path
        return f"{self.config.base_url}{path}"

    def get(self, path: str, params: dict[str, str] | None = None) -> Any:
        url = self._url(path)
        if params:
            from urllib.parse import urlencode

            url = f"{url}?{urlencode(params)}"
        return self._request(url, method="GET")

    def post(self, path: str, payload: dict[str, Any] | None = None) -> Any:
        from urllib.parse import urlparse

        url = self._url(path)
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise ApiError(f"Unsupported URL scheme: {parsed.scheme}")
        data = json.dumps(payload or {}).encode("utf-8")
        return self._request(url, method="POST", data=data)

    def _request(self, url: str, method: str, data: bytes | None = None) -> Any:
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("accept", "application/json")
        if data is not None:
            request.add_header("content-type", "application/json")
        try:
            with urllib.request.urlopen(request, timeout=self.config.timeout_seconds) as response:
                body = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:  # pragma: no cover - network dependent
            raise ApiError(f"HTTP {exc.code} from {url}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:  # pragma: no cover
            raise ApiError(f"Cannot reach ARK Omniscience at {self.config.base_url}: {exc}") from exc
        if not body:
            return {}
        try:
            return json.loads(body)
        except ValueError as exc:  # pragma: no cover
            raise ApiError(f"Invalid JSON from {url}") from exc

    def health(self) -> dict[str, Any]:
        return self.get("/api/health")

    def state(self) -> dict[str, Any]:
        return self.get("/api/state")

    def analyse_combination(self, slugs: Iterable[str], context: str) -> dict[str, Any]:
        return self.post("/api/combinations", {"slugs": list(slugs), "context": context})

    def run_agent(self, agent_code: str) -> dict[str, Any]:
        return self.post("/api/agents", {"agentCode": agent_code})

    def run_cycle(self) -> dict[str, Any]:
        return self.post("/api/orchestrator", {})

    def record_results(self, experiment_code: str, measurements: list[dict[str, Any]], replicates: int, notes: str) -> dict[str, Any]:
        return self.post(
            "/api/experiments",
            {
                "experimentCode": experiment_code,
                "measurements": measurements,
                "replicates": replicates,
                "notes": notes,
            },
        )



# ----------------------------------------------------------------- embedded KB

def embedded_kb_path() -> Path:
    here = Path(__file__).resolve().parent
    candidates = [
        here / "data" / "knowledge_base.json",
        Path(getattr(sys, "_MEIPASS", here)) / "data" / "knowledge_base.json",
    ]
    for cand in candidates:
        if cand.exists():
            return cand
    return candidates[0]


def load_embedded_kb() -> dict[str, Any]:
    path = embedded_kb_path()
    if not path.exists():
        raise ArkOmniscienceError(f"Embedded knowledge base not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


class EmbeddedRepository:
    """Offline access to the bundled knowledge base (no server required)."""

    def __init__(self, data: dict[str, Any] | None = None) -> None:
        self.data = data if data is not None else load_embedded_kb()

    def creatures(self) -> list[Creature]:
        return [Creature.from_api(row) for row in self.data.get("creatures", [])]

    def buffs(self) -> list[dict[str, Any]]:
        return list(self.data.get("buffs", []))

    def bosses(self) -> list[dict[str, Any]]:
        return list(self.data.get("bosses", []))

    def stats(self) -> dict[str, Any]:
        return dict(self.data.get("stats", {}))


# ----------------------------------------------------------------- repository


@dataclass
class Creature:
    slug: str
    name: str
    species: str
    tier: str
    profile: dict[str, float] = field(default_factory=dict)
    roles: list[str] = field(default_factory=list)
    notes: str = ""
    underrated: bool = False
    confidence: str = "documented"

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "Creature":
        return cls(
            slug=str(data.get("slug", "")),
            name=str(data.get("name", "")),
            species=str(data.get("species", "")),
            tier=str(data.get("tier", "")),
            profile=dict(data.get("profile") or {}),
            roles=list(data.get("roles") or []),
            notes=str(data.get("notes", "")),
            underrated=bool(data.get("underrated", False)),
            confidence=str(data.get("confidence", "documented")),
        )


@dataclass
class Discovery:
    code: str
    title: str
    summary: str
    domain: str
    classification: str
    confidence_score: int
    surprising: bool
    found_by: str

    @property
    def rank(self) -> int:
        return CLASSIFICATION_ORDER.get(self.classification, 0)


@dataclass
class Experiment:
    code: str
    title: str
    status: str
    classification: str
    confidence: int
    procedure: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)


class Repository:
    """Reads from the live API, or from an offline export when unavailable."""

    def __init__(self, client: ApiClient, config: Config) -> None:
        self.client = client
        self.config = config

    # -- offline -----------------------------------------------------------

    def embedded(self) -> EmbeddedRepository:
        return EmbeddedRepository()

    def load_export(self, path: str | None = None) -> dict[str, Any]:
        export_path = Path(path or self.config.offline_export)
        if not export_path.exists():
            raise ArkOmniscienceError(f"Offline export not found: {export_path}")
        return json.loads(export_path.read_text(encoding="utf-8"))

    # -- live --------------------------------------------------------------

    def creatures(self) -> list[Creature]:
        try:
            payload = self.client.get("/api/creatures")
        except ApiError:
            return self.embedded().creatures()
        return [Creature.from_api(row) for row in payload.get("creatures", [])]

    def buffs(self) -> list[dict[str, Any]]:
        try:
            return list(self.client.get("/api/buffs").get("buffs", []))
        except ApiError:
            return self.embedded().buffs()

    def discoveries(self) -> list[Discovery]:
        payload = self.client.get("/api/research", {"type": "discoveries", "limit": "500"})
        return [
            Discovery(
                code=str(row.get("code", "")),
                title=str(row.get("title", "")),
                summary=str(row.get("summary", "")),
                domain=str(row.get("domain", "")),
                classification=str(row.get("classification", "UNVERIFIED")),
                confidence_score=int(row.get("confidenceScore", 0) or 0),
                surprising=bool(row.get("surprising", False)),
                found_by=str(row.get("foundBy", "")),
            )
            for row in payload.get("discoveries", [])
        ]

    def experiments(self) -> list[Experiment]:
        payload = self.client.get("/api/experiments")
        return [
            Experiment(
                code=str(row.get("code", "")),
                title=str(row.get("title", "")),
                status=str(row.get("status", "")),
                classification=str(row.get("classification", "UNVERIFIED")),
                confidence=int(row.get("confidence", 0) or 0),
                procedure=list(row.get("procedure") or []),
                limitations=str(row.get("limitations", "")).splitlines(),
            )
            for row in payload.get("experiments", [])
        ]

    def reports(self) -> list[dict[str, Any]]:
        return list(self.client.get("/api/reports").get("reports", []))


# ------------------------------------------------------------------- ranking


def rank_discoveries(discoveries: Iterable[Discovery], *, surprising_only: bool = False) -> list[Discovery]:
    """Rank by classification then confidence; surprising findings surface first on ties."""
    items = [d for d in discoveries if (d.surprising or not surprising_only)]
    return sorted(items, key=lambda d: (d.rank, d.confidence_score, d.surprising), reverse=True)


def rank_creatures(creatures: Iterable[Creature], axis: str = "utility") -> list[Creature]:
    return sorted(creatures, key=lambda c: float(c.profile.get(axis, 0)), reverse=True)


def awaiting_manual_testing(experiments: Iterable[Experiment]) -> list[Experiment]:
    return [e for e in experiments if e.status == "pending-manual-testing"]


def summary_lines(state: dict[str, Any]) -> list[str]:
    """Build the command-centre summary from an /api/state payload."""
    kb = state.get("knowledgeBase", {}) or {}
    counts = state.get("counts", {}) or {}
    lines = [
        f"Knowledge base: {kb.get('creatures', 0)} creatures, {kb.get('buffs', 0)} effects, {kb.get('abilities', 0)} ability records",
        f"Agents online: {len(state.get('agents', []))} of 12",
        f"Tasks: {counts.get('queued', 0)} queued, {counts.get('completed', 0)} completed",
        f"Experiments awaiting manual testing: {counts.get('experimentsAwaiting', 0)}",
    ]
    for agent in state.get("agents", [])[:12]:
        lines.append(f"  {agent.get('code')}: {agent.get('name')} — {agent.get('findingsCount', 0)} findings, {agent.get('tasksCompleted', 0)} tasks")
    return lines
