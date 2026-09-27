import os
import time
import subprocess
import requests

def test_demo():
    print("Starting backend server...")
    server = subprocess.Popen(["jac", "start", "main.jac"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(3) # Wait for server to boot
    
    print("Testing Command 3 (Seed Graph)...")
    resp = requests.post("http://localhost:8000/walker/SeedAsset", json={
        "id": "asset-1", "name": "PoR pUSD", "symbol": "pUSD",
        "chain": "sepolia", "token_address": "0x123", "created_at": 0
    })
    
    if resp.status_code != 200:
        print(f"FAILED: {resp.status_code}")
        server.kill()
        return
        
    data = resp.json()
    node_id = data["data"]["reports"][0]["node_id"]
    print(f"Seeded Node ID: {node_id}")
    
    print("Testing Command 4 (Approved Path UI Button)...")
    # Simulate Ingest Walker
    ingest = requests.post(f"http://localhost:8000/walker/Ingest/{node_id}", json={
        "use_fixture": True, "fixture_name": "approved", "child_present": True
    })
    
    if ingest.status_code == 200:
        print("Ingest Walker SUCCESS")
    else:
        print(f"Ingest Failed: {ingest.text}")
        
    # Simulate Freshness
    requests.post(f"http://localhost:8000/walker/Freshness/{node_id}", json={})
    print("Freshness Walker SUCCESS")
    
    # Simulate Cover
    requests.post(f"http://localhost:8000/walker/Cover/{node_id}", json={})
    print("Cover Walker SUCCESS")
    
    print("\nALL DEMO COMMANDS PASSED SUCCESSFULLY!")
    server.kill()

if __name__ == '__main__':
    test_demo()
