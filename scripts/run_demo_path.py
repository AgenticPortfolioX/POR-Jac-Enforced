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
    """POST a walker to Jac runtime. Node-scoped walkers are invoked at /walker/{Name}/{node_id}."""
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
    print(f"    reports: {json.dumps(data.get('data', {}).get('reports', []), indent=2)}")
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
    if len(sys.argv) < 2 or sys.argv[1] not in ["happy", "yellow", "unknown", "live"]:
        print("Usage: python run_demo_path.py <happy|yellow|unknown|live>")
        sys.exit(1)

    path = sys.argv[1]
    print(f"\n=== Verification Path: {path.upper()} ===")

    node_id = seed()

    # DemoControl orchestrates Ingest (live or fixture) and triggers Freshness -> Cover -> Auditor
    post("DemoControl", {"path": path}, node_id)

    # Inspect the updated graph structure and stamps
    post("GetAsset", {"asset_id": ASSET_ID}, node_id)

    # Act verifies the three green stamps and coverage payload before authorizing minting
    post("Act", {
        "asset_id": ASSET_ID,
        "requested_amount": REQUESTED_AMOUNT,
        "recipient": RECIPIENT,
        "token_address": os.environ.get("POR_TOKEN_ADDRESS", ""),
        "attestation_address": os.environ.get("POR_ATTESTATION_ADDRESS", ""),
    }, node_id)

    # Counsel generates an explainability summary based exclusively on stamp nodes
    post("Counsel", {"asset_id": ASSET_ID}, node_id)


if __name__ == "__main__":
    main()
