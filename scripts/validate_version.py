#!/usr/bin/env python3
"""Print the repository's current shipped version, or fail if it's missing/invalid.

Reused as-is from the same-shaped script in Sean's HA integration repos
(ha_int_monoprice_6chan etc.), minus the zip-archive building those repos
need and this one doesn't - HACS installs this as a single JS file (a
release asset here, since dist/ isn't committed; committed directly to the
tree for lovelace-template-entity-row), not a zip.

Usage:
    python3 -m scripts.validate_version
"""

from __future__ import annotations

import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.release_config import load, validate_versions


def main() -> int:
    config = load(Path(__file__).resolve().parents[1])
    print(validate_versions(config))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
