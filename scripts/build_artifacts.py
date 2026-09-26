# scripts/build_artifacts.py
# Purpose: Flatten forge output into the artifacts/{Name}.json shape the runtime reads
# Owner walker/module: shared
# Spec: see PRD §10
# Status: IMPLEMENTED — Prompt 4
#
# `forge build` writes out/{File}.sol/{Name}.json. Both scripts/deploy_contracts.py
# and jac/lib/evm_py.py read a flat artifacts/{Name}.json holding the ABI (and, for
# deployment, the bytecode). This script bridges the two.

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT = ROOT / "out"
ARTIFACTS = ROOT / "artifacts"

CONTRACTS = ["PoRToken", "PoRAttestation"]


def flatten(name: str) -> bool:
    """Write artifacts/{name}.json from out/{name}.sol/{name}.json."""
    source = OUT / f"{name}.sol" / f"{name}.json"
    if not source.exists():
        print(f"ERROR: {source} not found. Run `forge build` first.")
        return False

    with open(source) as f:
        compiled = json.load(f)

    artifact = {
        "abi": compiled["abi"],
        "bytecode": compiled["bytecode"]["object"],
    }

    ARTIFACTS.mkdir(exist_ok=True)
    with open(ARTIFACTS / f"{name}.json", "w") as f:
        json.dump(artifact, f, indent=2)

    print(f"wrote artifacts/{name}.json ({len(artifact['abi'])} ABI entries)")
    return True


def main() -> None:
    if not OUT.exists():
        print("ERROR: out/ not found. Run `forge build` first.")
        sys.exit(1)

    if not all(flatten(name) for name in CONTRACTS):
        sys.exit(1)


if __name__ == "__main__":
    main()
