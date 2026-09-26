# scripts/seed_graph.py
# Purpose: Seed the root Asset node via the SeedAsset walker
# Owner walker/module: shared
# Spec: see PRD §9
# Status: IMPLEMENTED — Prompt 9

import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

JAC = os.environ.get("JAC_CLOUD_URL", "http://localhost:8000")
TOKEN_ADDR = os.environ.get("POR_TOKEN_ADDRESS", "")


def main():
    url = f"{JAC}/walker/SeedAsset"
    body = {
        "id": "asset-1",
        "name": "PoR pUSD",
        "symbol": "pUSD",
        "chain": "sepolia",
        "token_address": TOKEN_ADDR,
        "created_at": 0,
    }
    print(f"POST {url}")
    resp = requests.post(url, json=body)
    print(f"Status: {resp.status_code}")

    data = resp.json()
    if data.get("ok") is False:
        print(f"ERROR: {json.dumps(data.get('error'))}")
        raise SystemExit(1)

    reports = data["data"]["reports"]
    print(json.dumps(reports, indent=2))
    # Every other walker is declared `with Asset entry`, so it only runs when spawned
    # on this node: POST /walker/{Name}/{node_id}. SeedAsset is the only root-invoked
    # endpoint and therefore the only way to discover the node id.
    print(f"\nAsset node id: {reports[0]['node_id']}")
    print(f"e.g. curl -X POST {JAC}/walker/GetAsset/{reports[0]['node_id']}")


if __name__ == "__main__":
    main()
