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
        print("Build contracts first: forge build && python scripts/build_artifacts.py")
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
    # build_transaction({}) below estimates gas by dry-running each call, and a
    # from-less estimate makes constructor-time Ownable(msg.sender) see address(0)
    # and revert with OwnableInvalidOwner. Default the account to the deployer so
    # every estimate is made as the account that will actually sign.
    w3.eth.default_account = deployer
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
    token_receipt = send(TokenContract.constructor("PoR pUSD", "pUSD").build_transaction({"from": deployer}))
    token_address = token_receipt["contractAddress"]
    print(f"PoRToken deployed:       {token_address}")
    print(f"  Etherscan: https://sepolia.etherscan.io/address/{token_address}")

    # Deploy PoRAttestation
    att_artifact = load_artifact("PoRAttestation")
    AttContract = w3.eth.contract(
        abi=att_artifact["abi"],
        bytecode=att_artifact["bytecode"],
    )
    att_receipt = send(AttContract.constructor().build_transaction({"from": deployer}))
    att_address = att_receipt["contractAddress"]
    print(f"PoRAttestation deployed: {att_address}")
    print(f"  Etherscan: https://sepolia.etherscan.io/address/{att_address}")

    # setActWalker(deployer) — for demo purposes; replace with Jac Cloud wallet in prod
    token_contract = w3.eth.contract(address=token_address, abi=token_artifact["abi"])
    send(token_contract.functions.setActWalker(deployer).build_transaction({"from": deployer}))
    print(f"setActWalker({deployer}) done")

    # Update the addresses in .env in place.
    #
    # Do NOT append. dotenv resolves duplicate keys last-wins, so appending wrote a
    # second POR_TOKEN_ADDRESS / POR_ATTESTATION_ADDRESS pair every time this script
    # ran, and any later blank pair (a freshly restored template, for instance) would
    # silently clobber the real addresses — leaving evm_py with an empty string and
    # Act failing closed with "Unknown format '', attempted to normalize to '0x'".
    # Rewriting each key on its existing line keeps exactly one definition per key.
    env_path = Path(__file__).parent.parent / ".env"
    updates = {
        "POR_TOKEN_ADDRESS": token_address,
        "POR_ATTESTATION_ADDRESS": att_address,
    }
    lines = env_path.read_text().splitlines() if env_path.exists() else []
    seen: set[str] = set()
    rewritten: list[str] = []
    for line in lines:
        key = line.split("=", 1)[0].strip() if "=" in line else ""
        if key in updates:
            # Keep only the first occurrence; drop any duplicates outright.
            if key in seen:
                continue
            seen.add(key)
            rewritten.append(f"{key}={updates[key]}")
        else:
            rewritten.append(line)
    for key, value in updates.items():
        if key not in seen:
            rewritten.append(f"{key}={value}")
    env_path.write_text("\n".join(rewritten) + "\n")
    print(".env updated with contract addresses (in place)")


if __name__ == "__main__":
    main()
