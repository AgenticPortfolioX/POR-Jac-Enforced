# scripts/deploy_contracts.py
# Purpose: Deploy PoRToken and PoRAttestation to Sepolia, set actWalker, write .env
# Owner walker/module: shared
# Spec: see PRD §10
# Status: IMPLEMENTED — Prompt 4

import os
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3
from eth_account import Account

load_dotenv()


def load_artifact(name: str) -> dict:
    path = Path(__file__).parent.parent / "artifacts" / f"{name}.json"
    if not path.exists():
        print(f"ERROR: artifact not found: {path}")
        print("Build contracts first: npx hardhat compile  or  forge build")
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def main():
    rpc_url = os.environ["SEPOLIA_RPC_URL"]
    private_key = os.environ["DEPLOYER_PRIVATE_KEY"]
    chain_id = int(os.environ.get("CHAIN_ID", "11155111"))

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    account = Account.from_key(private_key)
    deployer = account.address
    print(f"Deployer: {deployer}")
    print(f"Balance:  {w3.from_wei(w3.eth.get_balance(deployer), 'ether')} ETH")

    nonce = w3.eth.get_transaction_count(deployer)

    def send(tx):
        nonlocal nonce
        tx.update({
            "from": deployer,
            "nonce": nonce,
            "gas": 3_000_000,
            "maxFeePerGas": w3.to_wei("30", "gwei"),
            "maxPriorityFeePerGas": w3.to_wei("2", "gwei"),
            "chainId": chain_id,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        nonce += 1
        return receipt

    # Deploy PoRToken
    token_artifact = load_artifact("PoRToken")
    TokenContract = w3.eth.contract(
        abi=token_artifact["abi"],
        bytecode=token_artifact["bytecode"],
    )
    token_receipt = send(TokenContract.constructor("PoR pUSD", "pUSD").build_transaction({}))
    token_address = token_receipt["contractAddress"]
    print(f"PoRToken deployed:       {token_address}")
    print(f"  Etherscan: https://sepolia.etherscan.io/address/{token_address}")

    # Deploy PoRAttestation
    att_artifact = load_artifact("PoRAttestation")
    AttContract = w3.eth.contract(
        abi=att_artifact["abi"],
        bytecode=att_artifact["bytecode"],
    )
    att_receipt = send(AttContract.constructor().build_transaction({}))
    att_address = att_receipt["contractAddress"]
    print(f"PoRAttestation deployed: {att_address}")
    print(f"  Etherscan: https://sepolia.etherscan.io/address/{att_address}")

    # setActWalker(deployer) — for demo purposes; replace with Jac Cloud wallet in prod
    token_contract = w3.eth.contract(address=token_address, abi=token_artifact["abi"])
    send(token_contract.functions.setActWalker(deployer).build_transaction({}))
    print(f"setActWalker({deployer}) done")

    # Append addresses to .env
    env_path = Path(__file__).parent.parent / ".env"
    with open(env_path, "a") as f:
        f.write(f"\nPOR_TOKEN_ADDRESS={token_address}")
        f.write(f"\nPOR_ATTESTATION_ADDRESS={att_address}")
    print(f".env updated with contract addresses")


if __name__ == "__main__":
    main()
