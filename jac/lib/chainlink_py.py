from web3 import Web3
import os
import json


def _load_abi() -> list:
    """Load AggregatorV3Interface ABI from contracts/interfaces."""
    abi_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "contracts", "interfaces", "AggregatorV3Interface.json"
    )
    if os.path.exists(abi_path):
        with open(abi_path, "r") as f:
            return json.load(f)
    # Minimal inline ABI if file not yet present
    return [
        {"name": "latestRoundData", "type": "function", "stateMutability": "view",
         "inputs": [], "outputs": [
             {"name": "roundId", "type": "uint80"},
             {"name": "answer", "type": "int256"},
             {"name": "startedAt", "type": "uint256"},
             {"name": "updatedAt", "type": "uint256"},
             {"name": "answeredInRound", "type": "uint80"},
         ]},
        {"name": "decimals", "type": "function", "stateMutability": "view",
         "inputs": [], "outputs": [{"name": "", "type": "uint8"}]},
    ]


def _w3() -> Web3:
    """Create a Web3 instance from SEPOLIA_RPC_URL env."""
    rpc_url = os.environ.get("SEPOLIA_RPC_URL", "")
    return Web3(Web3.HTTPProvider(rpc_url))


def latest_round(feed_address: str) -> dict:
    """
    Fetch the latest round data from a Chainlink price feed.
    Returns a dict with all primitives — no web3 types.
    """
    w3 = _w3()
    abi = _load_abi()
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(feed_address),
        abi=abi,
    )
    round_id, answer, started_at, updated_at, answered_in_round = (
        contract.functions.latestRoundData().call()
    )
    decimals = int(contract.functions.decimals().call())
    answer_float = float(answer) / float(10 ** decimals)

    return {
        "round_id": int(round_id),
        "answer": float(answer_float),
        "started_at": int(started_at),
        "updated_at": int(updated_at),
        "answered_in_round": int(answered_in_round),
        "feed_address": str(feed_address),
        "decimals": int(decimals),
    }
