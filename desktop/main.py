#!/usr/bin/env python3
"""Entry point for the ARK Omniscience desktop application.

Usage:
    python desktop/main.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ark_omniscience.app import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
