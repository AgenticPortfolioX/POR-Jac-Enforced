# scripts/run_demo_path.py
# Purpose: CLI runner for three-path demo verification
# Owner walker/module: shared
# Spec: see PRD §13
# Status: IMPLEMENTED — Prompt 9

import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv()

JAC = os.environ.get("JAC_CLOUD_URL", "http://localhost:8000")
ASSET_ID = "asset-1"
REQUESTED_AMOUNT = float(os.environ.get("DEMO_REQUESTED_AMOUNT", "1000000"))
RECIPIENT = os.environ.get("DEMO_RECIPIENT", "0x0000000000000000000000000000000000000000")


def post(walker: str, body: dict = {}, node_id: str = "") -> dict:
    """POST a walker. Walkers declared `with Asset entry` only run when spawned ON
    the asset node, so node_id is passed as a path param (/walker/{Name}/{node_id})."""
    url = f"{JAC}/walker/{walker}" + (f"/{node_id}" if node_id else "")
    print(f"\n>>> POST {url}")
    print(f"    body: {json.dumps(body)}")
    resp = requests.post(url, json=body)
    print(f"    status: {resp.status_code}")
    try:
        data = resp.json()
    except Exception:
        print(f"    raw: {resp.text}")
        return {}
    if data.get("ok") is False:
        print(f"    ERROR: {json.dumps(data.get('error'))}")
        return data
    print(f"    reports: {json.dumps(data['data']['reports'], indent=2)}")
    return data


def seed() -> str:
    """Seed the Asset (idempotent) and return its graph node id."""
    data = post("SeedAsset", {
        "id": ASSET_ID,
        "name": "PoR pUSD",
        "symbol": "pUSD",
        "chain": "sepolia",
        "token_address": os.environ.get("POR_TOKEN_ADDRESS", ""),
        "created_at": 0,
    })
    reports = (data.get("data") or {}).get("reports") or []
    if not reports:
        print("FATAL: SeedAsset returned no report; cannot resolve node id.")
        sys.exit(1)
    node_id = reports[0]["node_id"]
    print(f"    asset node id: {node_id}")
    return node_id


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ["happy", "yellow", "unknown"]:
        print("Usage: python run_demo_path.py <happy|yellow|unknown>")
        sys.exit(1)

    path = sys.argv[1]
    print(f"\n=== Demo Path: {path} ===")

    node_id = seed()

    # DemoControl seeds fixtures and runs Freshness -> Cover -> Auditor
    post("DemoControl", {"path": path}, node_id)

    # Final graph state: three StampedBy entries with their colors
    post("GetAsset", {"asset_id": ASSET_ID}, node_id)

    # Act is the only minter; it reads the three stamps and the Cover payload
    post("Act", {
        "asset_id": ASSET_ID,
        "requested_amount": REQUESTED_AMOUNT,
        "recipient": RECIPIENT,
        "token_address": os.environ.get("POR_TOKEN_ADDRESS", ""),
        "attestation_address": os.environ.get("POR_ATTESTATION_ADDRESS", ""),
    }, node_id)

    # Counsel narrates only once all three stamps exist
    post("Counsel", {"asset_id": ASSET_ID}, node_id)


if __name__ == "__main__":
    main()
