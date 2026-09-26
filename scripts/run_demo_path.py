# scripts/run_demo_path.py
# Purpose: CLI runner for three-path demo verification
# Owner walker/module: shared
# Spec: see PRD §13
# Status: IMPLEMENTED — Prompt 9

import sys
import json
import requests

JAC = "http://localhost:8000"
ASSET_ID = "asset-1"


def post(walker: str, body: dict = {}) -> dict:
    url = f"{JAC}/walker/{walker}"
    print(f"\n>>> POST {url}")
    print(f"    body: {json.dumps(body)}")
    resp = requests.post(url, json=body)
    print(f"    status: {resp.status_code}")
    try:
        data = resp.json()
        print(f"    response: {json.dumps(data, indent=2)}")
        return data
    except Exception:
        print(f"    raw: {resp.text}")
        return {}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ["happy", "yellow", "unknown"]:
        print("Usage: python run_demo_path.py <happy|yellow|unknown>")
        sys.exit(1)

    path = sys.argv[1]
    print(f"\n=== Demo Path: {path} ===")

    # Ensure asset is seeded
    post("SeedAsset", {
        "id": ASSET_ID,
        "name": "PoR pUSD",
        "symbol": "pUSD",
        "chain": "sepolia",
        "token_address": "",
        "created_at": 0,
    })

    # Run DemoControl for the path
    post("DemoControl", {"asset_id": ASSET_ID, "path": path})

    # Fetch final graph state
    post("GetAsset", {"asset_id": ASSET_ID})


if __name__ == "__main__":
    main()
