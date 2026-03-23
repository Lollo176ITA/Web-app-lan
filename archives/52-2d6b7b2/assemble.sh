#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
import json
import pathlib

root = pathlib.Path(".")
metadata = json.loads((root / "build-info.json").read_text(encoding="utf-8"))

for entry in metadata["files"]:
    if not entry.get("split"):
        continue

    destination = root / entry["name"]
    with destination.open("wb") as output:
        for part in entry["parts"]:
            output.write((root / part["name"]).read_bytes())

    print(f"assembled {destination}")
PY
