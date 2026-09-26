# jac/lib/evm_py.py
# Purpose: Python bridge to EVM — mint tokens and attestation NFTs via web3.py
# Owner walker/module: Act (exclusive)
# Spec: see PRD §8
# Status: IMPLEMENTED — Prompt 7

import os
import json
from pathlib import Path

from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv

load_dotenv()


def _w3_and_account():
    rpc_url = os.environ.get("SEPOLIA_RPC_URL", "")
    private_key = os.environ.get("DEPLOYER_PRIVATE_KEY", "")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    acct = Account.from_key(private_key)
    # build_transaction({}) estimates gas by dry-running the call, and an
    # unestimated call has no `from`. PoRToken.mint is guarded by onlyAct, so a
    # from-less estimate would revert and the real send would never be built.
    # Defaulting the account here makes every estimate run as the signer.
    w3.eth.default_account = acct.address
    return w3, acct


def _load_abi(contract_name: str) -> list:
    path = Path(__file__).parent.parent.parent / "artifacts" / f"{contract_name}.json"
    if not path.exists():
        # Minimal stub ABI so tests can import without artifacts built
        return []
    with open(path) as f:
        data = json.load(f)
    return data.get("abi", data)


def _send(w3, acct, tx_dict: dict):
    chain_id = int(os.environ.get("CHAIN_ID", "11155111"))
    nonce = w3.eth.get_transaction_count(acct.address)
    tx_dict.update({
        "from": acct.address,
        "nonce": nonce,
        "gas": 400_000,
        "maxFeePerGas": w3.to_wei("30", "gwei"),
        "maxPriorityFeePerGas": w3.to_wei("2", "gwei"),
        "chainId": chain_id,
    })
    signed = acct.sign_transaction(tx_dict)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return receipt


def mint(token_address: str, to: str, amount: float, reason_json: str) -> str:
    """
    Mint PoRToken. All arguments are primitives.
    Returns the tx hash as a hex string.
    """
    w3, acct = _w3_and_account()
    abi = _load_abi("PoRToken")
    contract = w3.eth.contract(address=Web3.to_checksum_address(str(token_address)), abi=abi)
    scaled = int(float(amount) * 10 ** 18)
    tx = contract.functions.mint(
        Web3.to_checksum_address(str(to)),
        scaled,
        str(reason_json),
    ).build_transaction({})
    receipt = _send(w3, acct, tx)
    return str(receipt.transactionHash.hex())


def mint_attestation(
    attestation_address: str,
    to: str,
    minted: float,
    coverage: float,
    price_time: int,
    reserve_time: int,
    stamp_summary: dict,
) -> int:
    """
    Mint PoRAttestation NFT. All arguments are primitives.
    Returns the tokenId as an int.
    """
    w3, acct = _w3_and_account()
    abi = _load_abi("PoRAttestation")
    contract = w3.eth.contract(address=Web3.to_checksum_address(str(attestation_address)), abi=abi)
    scaled_minted = int(float(minted) * 10 ** 18)
    scaled_coverage = int(float(coverage) * 10 ** 18)
    summary_str = json.dumps(dict(stamp_summary))
    tx = contract.functions.mintAttestation(
        Web3.to_checksum_address(str(to)),
        scaled_minted,
        scaled_coverage,
        int(price_time),
        int(reserve_time),
        summary_str,
    ).build_transaction({})
    receipt = _send(w3, acct, tx)
    logs = contract.events.AttestationMinted().process_receipt(receipt)
    return int(logs[0]["args"]["tokenId"])
