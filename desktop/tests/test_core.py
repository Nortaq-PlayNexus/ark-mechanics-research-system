"""Unit tests for the ARK Omniscience desktop client core.

Run with:  python -m unittest discover -s desktop/tests -v
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ark_omniscience.core import (  # noqa: E402
    ApiClient,
    ApiError,
    ArkOmniscienceError,
    Config,
    Creature,
    Discovery,
    Repository,
    awaiting_manual_testing,
    rank_creatures,
    rank_discoveries,
    summary_lines,
)


class ConfigTests(unittest.TestCase):
    def test_defaults_and_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            import os

            os.environ["ARK_OMNI_CONFIG_DIR"] = tmp
            try:
                cfg = Config(base_url="http://localhost:9999/")
                cfg.save()
                self.assertTrue((Path(tmp) / "ark_omniscience.json").exists())
                loaded = Config().load()
                self.assertEqual(loaded.base_url, "http://localhost:9999")
                self.assertEqual(loaded.timeout_seconds, 15.0)
            finally:
                os.environ.pop("ARK_OMNI_CONFIG_DIR", None)

    def test_invalid_timeout_falls_back(self) -> None:
        cfg = Config.from_dict({"timeout_seconds": "not-a-number"})
        self.assertEqual(cfg.timeout_seconds, 15.0)

    def test_base_url_trailing_slash_stripped(self) -> None:
        cfg = Config.from_dict({"base_url": "http://x/"})
        self.assertEqual(cfg.base_url, "http://x")


class ApiClientTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = ApiClient(Config(base_url="http://example.invalid"))

    def test_url_building(self) -> None:
        self.assertEqual(self.client._url("/api/health"), "http://example.invalid/api/health")
        self.assertEqual(self.client._url("api/health"), "http://example.invalid/api/health")

    def test_unreachable_server_raises_api_error(self) -> None:
        with self.assertRaises(ApiError):
            self.client.get("/api/health")

    def test_post_rejects_bad_scheme(self) -> None:
        client = ApiClient(Config(base_url="ftp://example.invalid"))
        with self.assertRaises(ApiError):
            client.post("/api/health", {})


class RepositoryTests(unittest.TestCase):
    def test_offline_export_missing_raises(self) -> None:
        repo = Repository(ApiClient(Config()), Config(offline_export="/nonexistent/path.json"))
        with self.assertRaises(ArkOmniscienceError):
            repo.load_export()

    def test_offline_export_loads(self) -> None:
        payload = {
            "format": "ark-omniscience/export",
            "counts": {"creatures": 2, "buffs": 1},
            "data": {
                "creatures": [
                    {"slug": "rex", "name": "Rex", "species": "T. dominum", "tier": "large", "profile": {"damage": 82}, "underrated": False},
                    {"slug": "thylacoleo", "name": "Thylacoleo", "species": "T. furtimorsus", "tier": "medium", "profile": {"damage": 70}, "underrated": True},
                ],
                "sources": [{"key": "wiki-root", "title": "ARK Wiki", "publisher": "Fandom", "sourceType": "wiki", "reliability": 4, "versionTag": "rolling"}],
                "breedingPrograms": [{"slug": "rex-boss-line", "species": "rex", "role": "Boss front-line", "statPriorities": ["health", "melee"], "generations": 8}],
            },
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "export.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            repo = Repository(ApiClient(Config()), Config(offline_export=str(path)))
            export = repo.load_export()
            self.assertEqual(export["counts"]["creatures"], 2)
            self.assertEqual(len(export["data"]["sources"]), 1)


class RankingTests(unittest.TestCase):
    def test_discoveries_ranked_by_classification_then_confidence(self) -> None:
        rows = [
            Discovery("A", "Unverified", "", "synergy", "UNVERIFIED", 50, False, "AGENT-02"),
            Discovery("B", "Confirmed", "", "synergy", "EXPERIMENTALLY-CONFIRMED", 60, False, "AGENT-10"),
            Discovery("C", "Replicated", "", "synergy", "INDEPENDENTLY-REPLICATED", 60, False, "AGENT-10"),
            Discovery("D", "Supported", "", "buff", "SOURCE-SUPPORTED", 80, False, "AGENT-04"),
        ]
        ranked = rank_discoveries(rows)
        self.assertEqual([d.code for d in ranked], ["C", "B", "D", "A"])

    def test_surprising_filter(self) -> None:
        rows = [
            Discovery("A", "a", "", "d", "UNVERIFIED", 10, False, "AGENT-01"),
            Discovery("B", "b", "", "d", "UNVERIFIED", 10, True, "AGENT-01"),
        ]
        self.assertEqual([d.code for d in rank_discoveries(rows, surprising_only=True)], ["B"])

    def test_creatures_ranked_by_axis(self) -> None:
        creatures = [
            Creature("rex", "Rex", "T. dominum", "large", {"utility": 40}),
            Creature("maewing", "Maewing", "M. pinguis", "medium", {"utility": 92}),
        ]
        self.assertEqual(rank_creatures(creatures, "utility")[0].slug, "maewing")

    def test_awaiting_manual_testing(self) -> None:
        from ark_omniscience.core import Experiment

        rows = [
            Experiment("EXP-0001", "a", "pending-manual-testing", "UNVERIFIED", 0),
            Experiment("EXP-0002", "b", "recorded", "PARTIALLY-VALIDATED", 55),
        ]
        self.assertEqual([e.code for e in awaiting_manual_testing(rows)], ["EXP-0001"])

    def test_summary_lines(self) -> None:
        state = {
            "knowledgeBase": {"creatures": 85, "buffs": 61, "abilities": 426},
            "agents": [{"code": "AGENT-01", "name": "Creature Intelligence Specialist", "findingsCount": 3, "tasksCompleted": 6}],
            "counts": {"queued": 4, "completed": 8, "experimentsAwaiting": 24},
        }
        lines = summary_lines(state)
        self.assertTrue(any("85 creatures" in line for line in lines))
        self.assertTrue(any("AGENT-01" in line for line in lines))


if __name__ == "__main__":
    unittest.main()
