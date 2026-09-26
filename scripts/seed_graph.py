# scripts/seed_graph.py
# Purpose: Seed the root Asset node via the Jac Cloud SeedAsset walker
# Owner walker/module: shared
# Spec: see PRD §9
# Status: IMPLEMENTED — Prompt 9

import os
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
    print(resp.text)


if __name__ == "__main__":
    main()
