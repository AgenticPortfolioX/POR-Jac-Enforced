#!/usr/bin/env python
"""
Phase 7 - the on-chain transaction.

This is the only script that broadcasts real transactions, and it is the phase
most likely to be reported dishonestly. So it reads the chain identity FIRST and
labels every number that follows with the chain it actually used. A local
development chain has no Etherscan page, and this script says so rather than
printing a Sepolia URL that will not resolve.

TWO MODES

  default             Use the configured deployment. Reads `POR_TOKEN_ADDRESS`,
                      `POR_ATTESTATION_ADDRESS`, `SEPOLIA_RPC_URL` and
                      `DEPLOYER_PRIVATE_KEY` from the environment (or `.env`).
                      If any is missing it exits naming the missing KEYS and
                      printing no values.

  --local-dev-chain   Deploy a fresh PoRToken + PoRAttestation to a local
                      development chain and exercise the full mint path there.
                      Nothing is written to `.env`; the addresses and the chain
                      env are held in this process and passed to the server it
                      starts. The result is a REAL transaction on chain 31337,
                      reported as chain 31337.

The local mode uses Anvil's default development key, which the `anvil` binary
prints on startup and which is therefore public knowledge. It is a throwaway key
for a throwaway chain and is not a secret. No credential of the operator's is
read, moved, or modified.

Run with the project venv (it has `web3`):

    .jac/venv/bin/python scripts/verify_chain.py                     # configured
    .jac/venv/bin/python scripts/verify_chain.py --local-dev-chain    # chain 31337
"""
import argparse
import json
import os
import sys
import time
from decimal import Decimal, ROUND_HALF_UP

import _runtime as rt

PASS = "PASS"
FAIL = "FAIL"
DEFERRED = "DEFERRED"

# Anvil's documented default account #0. Public by construction.
ANVIL_DEV_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
ANVIL_DEV_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

# Tried in order when --rpc is not given. From inside WSL, Anvil on the Windows
# host answers on the gateway address; from Windows it answers on loopback.
LOCAL_RPC_CANDIDATES = ("http://172.24.112.1:8545", "http://127.0.0.1:8545")

EXPLORERS = {11155111: "https://sepolia.etherscan.io"}
CHAIN_NAMES = {11155111: "Sepolia", 31337: "local development chain (Anvil)", 1: "mainnet"}

REQUESTED_AMOUNT = 1_000_000.0


def wei_exact(amount: float) -> int:
    """
    The exact base-unit value of `amount`, per §24 D2.

    Deliberately NOT `int(float(amount) * 10**18)` - that expression is the
    defect this script exists to detect, and comparing the chain against it would
    prove nothing.
    """
    scaled = Decimal(str(amount)) * Decimal(10) ** 18
    return int(scaled.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def load_artifact(name: str) -> tuple[list, str]:
    path = os.path.join(rt.PROJECT_ROOT, "artifacts", f"{name}.json")
    if not os.path.exists(path):
        raise RuntimeError(f"artifact {path} is missing - run the contract build first")
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    return data["abi"], data["bytecode"]


def connect(rpc: str):
    from web3 import Web3
    return Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 20}))


def deploy_local(rpc: str):
    """Deploy both contracts to a local chain. Returns (w3, acct, token_addr, att_addr)."""
    from eth_account import Account

    w3 = connect(rpc)
    acct = Account.from_key(ANVIL_DEV_KEY)

    token_abi, token_bc = load_artifact("PoRToken")
    factory = w3.eth.contract(abi=token_abi, bytecode=token_bc)
    tx = factory.constructor("PoR jUSD", "jUSD").transact(
        {"from": acct.address, "gas": 3_000_000})
    token_addr = w3.eth.wait_for_transaction_receipt(tx).contractAddress
    print(f"  deployed PoRToken        -> {token_addr}")

    att_abi, att_bc = load_artifact("PoRAttestation")
    factory = w3.eth.contract(abi=att_abi, bytecode=att_bc)
    tx = factory.constructor().transact({"from": acct.address, "gas": 3_000_000})
    att_addr = w3.eth.wait_for_transaction_receipt(tx).contractAddress
    print(f"  deployed PoRAttestation -> {att_addr}")

    # PoRToken.mint is `onlyAct`, and actWalker is set separately by the owner.
    # Without this the only account that could mint is the zero address, and
    # every Act call would revert.
    token = w3.eth.contract(address=token_addr, abi=token_abi)
    tx = token.functions.setActWalker(acct.address).transact({"from": acct.address})
    w3.eth.wait_for_transaction_receipt(tx)
    print(f"  setActWalker            -> {acct.address}")
    return w3, acct, token_addr, att_addr


def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 7 - the on-chain transaction")
    parser.add_argument("--local-dev-chain", action="store_true",
                        help="deploy fresh contracts to a local dev chain (31337)")
    parser.add_argument("--rpc", default="", help="override the RPC endpoint")
    args = parser.parse_args()

    print("=" * 74)
    print("PHASE 7 - THE ON-CHAIN TRANSACTION")
    print("=" * 74)

    findings: list = []
    failures: list = []
    verdict = PASS

    # --- 7.1 preconditions ---------------------------------------------------
    print("\n[1/9] Preconditions")
    if args.local_dev_chain:
        print("  --local-dev-chain: the configured deployment is NOT used.")
        print("  Only artifacts/ and a reachable local chain are required.")
        local_mode = True
    else:
        required = ("POR_TOKEN_ADDRESS", "POR_ATTESTATION_ADDRESS",
                    "SEPOLIA_RPC_URL", "DEPLOYER_PRIVATE_KEY")
        missing = [key for key in required if not os.environ.get(key, "")]
        if missing:
            print(f"  {FAIL}: missing KEYS: {', '.join(missing)}")
            print("  (values are never printed; only presence is checked)")
            print(f"\n  {DEFERRED}: the configured deployment is not present in this")
            print("  environment, so no transaction can be broadcast against it.")
            print("  Re-run with --local-dev-chain to exercise the same code path on a")
            print("  local chain, or supply the keys above.")
            print("\n" + "=" * 74)
            print(f"RESULT: {DEFERRED} - preconditions unmet (missing: {', '.join(missing)})")
            print("=" * 74)
            return 2
        print(f"  {PASS}: all four required keys are present (values not printed)")
        local_mode = False

    # --- connect and deploy if needed ---------------------------------------
    rpc = args.rpc
    if not rpc:
        if local_mode:
            probe_errors: list[str] = []
            for candidate in LOCAL_RPC_CANDIDATES:
                try:
                    if connect(candidate).is_connected():
                        rpc = candidate
                        break
                except Exception as exc:
                    probe_errors.append(f"{candidate}: {type(exc).__name__}: {exc}")
                    continue
            if not rpc:
                print(f"  {DEFERRED}: no local chain answered at "
                      f"{' or '.join(LOCAL_RPC_CANDIDATES)}")
                for err in probe_errors:
                    print(f"    probe failed -> {err}")
                if any('No module' in e or 'web3' in e for e in probe_errors):
                    print("    CAUSE: web3 is not importable by this interpreter. "
                          "Run this script with .jac/venv/bin/python (AuditTestPrompt2 §19).")
                return 2
        else:
            rpc = os.environ["SEPOLIA_RPC_URL"]

    print(f"\n[2/9] Chain identity (read from w3.eth.chain_id, not assumed)")
    try:
        w3 = connect(rpc)
        chain_id = w3.eth.chain_id
    except Exception as exc:
        print(f"  {DEFERRED}: cannot reach {rpc}: {exc}")
        return 2
    chain_name = CHAIN_NAMES.get(chain_id, "unrecognised chain")
    print(f"  rpc      : {rpc}")
    print(f"  chain id : {chain_id}  ({chain_name})")
    if chain_id != 11155111:
        print(f"  NOTE: this is NOT Sepolia. Every result below is a chain-{chain_id} "
              f"result.")
    chain_label = f"{chain_id} ({chain_name})"

    if local_mode:
        print("\n  deploying fresh contracts to this chain...")
        try:
            w3, acct, token_addr, att_addr = deploy_local(rpc)
        except Exception as exc:
            print(f"  {FAIL}: deployment failed: {exc}")
            return 1
        server_env = {
            "SEPOLIA_RPC_URL": rpc,
            "DEPLOYER_PRIVATE_KEY": ANVIL_DEV_KEY,
            "CHAIN_ID": str(chain_id),
            "POR_TOKEN_ADDRESS": token_addr,
            "POR_ATTESTATION_ADDRESS": att_addr,
        }
    else:
        from eth_account import Account
        token_addr = os.environ["POR_TOKEN_ADDRESS"]
        att_addr = os.environ["POR_ATTESTATION_ADDRESS"]
        acct = Account.from_key(os.environ["DEPLOYER_PRIVATE_KEY"])
        server_env = None
        print(f"  token    : {token_addr}")
        print(f"  attest.  : {att_addr}")

    recipient = acct.address
    token_abi, _ = load_artifact("PoRToken")
    att_abi, _ = load_artifact("PoRAttestation")
    token = w3.eth.contract(address=w3.to_checksum_address(token_addr), abi=token_abi)
    attestation = w3.eth.contract(address=w3.to_checksum_address(att_addr), abi=att_abi)

    # --- 7.3 pre-state -------------------------------------------------------
    print("\n[3/9] Pre-state")
    bal_before = token.functions.balanceOf(recipient).call()
    supply_before = token.functions.totalSupply().call()
    next_id_before = 0
    try:
        logs = attestation.events.AttestationMinted().get_logs(from_block=0)
        if logs:
            next_id_before = max(int(entry["args"]["tokenId"]) for entry in logs)
    except Exception as exc:
        print(f"  (could not read AttestationMinted history: {exc})")
    print(f"  recipient token bal.  : {bal_before} wei   "
          f"[PoRToken.balanceOf(recipient) - NOT the deployer's native balance]")
    print(f"  PoRToken totalSupply  : {supply_before} wei")
    print(f"  last attestation id   : {next_id_before}")

    # --- 7.4 happy path ------------------------------------------------------
    print("\n[4/9] Happy path on a fresh asset")
    try:
        rt.reset_store()
        log_path = "/tmp/porje_verify_chain_server.log"
        proc = rt.start_server(log_path=log_path, extra_env=server_env)
        if not rt.wait_for_healthz():
            print(f"  {FAIL}: the server never became healthy")
            print(f"  server log:\n{_tail(log_path)}")
            rt.stop_server(proc)
            return 1
        node_id = rt.seed_asset()
        rt.require_ok(rt.post_walker("DemoControl", {"path": "happy"}, node_id),
                      "DemoControl(happy)")
        payload = rt.get_asset(node_id)
    except Exception as exc:
        print(f"  {FAIL}: {type(exc).__name__}: {exc}")
        try:
            rt.stop_server(proc)
        except Exception:
            pass
        return 1

    covers = [e for e in payload["edges"]
              if e["type"] == "StampedBy" and e["target"]["walker_name"] == "Cover"]
    if not covers:
        print(f"  {FAIL}: no Cover stamp after the happy path")
        rt.stop_server(proc)
        return 1
    justified = float(covers[0]["target"]["payload"]["justified_amount"])
    print(f"  Cover justified amount: {justified}")

    # --- 7.5 mint via Act ----------------------------------------------------
    print(f"\n[5/9] Minting via Act (requested {REQUESTED_AMOUNT})")
    expected_amount = min(REQUESTED_AMOUNT, justified)
    try:
        envelope = rt.post_walker("Act", {
            "requested_amount": REQUESTED_AMOUNT,
            "recipient": recipient,
            "token_address": token_addr,
            "attestation_address": att_addr,
        }, node_id)
        reports = rt.require_ok(envelope, "Act")
    except Exception as exc:
        print(f"  {FAIL}: Act failed: {exc}")
        rt.stop_server(proc)
        return 1
    report = reports[0] if reports else {}
    print(f"  Act report: {json.dumps(report, default=str)}")

    if not report.get("minted"):
        print(f"  {FAIL}: Act refused: {report.get('reason')!r}")
        failures.append(f"Act refused the happy path: {report.get('reason')!r}")
        rt.stop_server(proc)
        _summary(chain_label, failures, findings, verdict, None)
        return 1

    tx_hash = str(report.get("tx", ""))
    nft_id = int(report.get("nft_id", 0))
    minted_amount = float(report.get("amount", 0.0))
    reported_justified = float(report.get("justified", 0.0))

    print(f"  minted    : {report.get('minted')}")
    print(f"  amount    : {minted_amount}  (expected min({REQUESTED_AMOUNT}, "
          f"{justified}) = {expected_amount})")
    print(f"  tx        : {tx_hash}")
    print(f"  nft_id    : {nft_id}")

    if abs(minted_amount - expected_amount) > 1e-6:
        failures.append(f"Act minted {minted_amount}, expected {expected_amount}")
    if not (len(tx_hash) == 66 and tx_hash.startswith("0x")):
        findings.append(
            f"D1 CONFIRMED - Act reported tx {tx_hash!r}: length {len(tx_hash)}, "
            f"0x-prefixed={tx_hash.startswith('0x')}. The documented form is a "
            f"0x-prefixed 66-character hash. Cause: `receipt.transactionHash.hex()` "
            f"in jac/lib/evm_py.py returns without the prefix under web3 >= 6 "
            f"(this environment has web3 {_web3_version()}).")
    if nft_id <= 0:
        failures.append(f"Act reported nft_id {nft_id}")

    # --- 7.6 on-chain verification -------------------------------------------
    print("\n[6/9] On-chain verification")
    if tx_hash.startswith("0x") and len(tx_hash) == 66:
        w3.eth.wait_for_transaction_receipt(tx_hash)

    bal_after = token.functions.balanceOf(recipient).call()
    supply_after = token.functions.totalSupply().call()
    delta_bal = bal_after - bal_before
    delta_supply = supply_after - supply_before
    expected_wei = wei_exact(minted_amount)

    print(f"  balance delta     : {delta_bal} wei")
    print(f"  totalSupply delta : {delta_supply} wei")
    print(f"  Decimal-exact     : {expected_wei} wei   "
          f"[Decimal(str({minted_amount})) * 10**18]")
    print(f"  int(float(...))   : {int(float(minted_amount) * 10 ** 18)} wei   "
          f"[what D2's expression would give - NOT what this code does]")

    if delta_bal != expected_wei or delta_supply != expected_wei:
        shortfall = expected_wei - delta_bal
        findings.append(
            f"D2 CONFIRMED - the minted base-unit amount is not the exact value. "
            f"Expected {expected_wei} wei from Decimal(str({minted_amount})); the "
            f"chain shows a balance delta of {delta_bal} and a totalSupply delta of "
            f"{delta_supply}. Difference: {shortfall} wei. Cause: "
            f"`int(float(amount) * 10**18)` in jac/lib/evm_py.py is a float64 "
            f"multiply, which cannot represent integers above 2**53 exactly. "
            f"totalSupply() now disagrees with the MintRecord's minted_amount.")
    else:
        print(f"  {PASS}: balance and supply both moved by the exact amount")

    if delta_bal != delta_supply:
        failures.append(
            f"balance delta {delta_bal} != totalSupply delta {delta_supply}")

    # Minted event
    try:
        logs = token.events.Minted().get_logs(from_block=0)
        if not logs:
            failures.append("no Minted event was emitted")
        else:
            entry = logs[-1]["args"]
            reason = json.loads(entry["reason"])
            print(f"  Minted event      : to={entry['to']} amount={entry['amount']} "
                  f"reason={entry['reason']}")
            if entry["to"].lower() != recipient.lower():
                failures.append(f"Minted event 'to' is {entry['to']}, expected {recipient}")
            if int(entry["amount"]) != delta_bal:
                failures.append(
                    f"Minted event amount {entry['amount']} != balance delta {delta_bal}")
            if reason.get("rule") != "PoRJE:Act":
                failures.append(f"Minted event reason rule is {reason.get('rule')!r}")
            if abs(float(reason.get("justified", -1)) - reported_justified) > 1e-6:
                failures.append(
                    f"Minted event justified {reason.get('justified')} != Act's "
                    f"reported {reported_justified}")
    except Exception as exc:
        failures.append(f"could not read the Minted event: {exc}")

    # The attestation NFT
    try:
        owner = attestation.functions.ownerOf(nft_id).call()
        record = attestation.functions.records(nft_id).call()
        minted_rec, coverage_rec, price_time, reserve_time, stamp_summary = record
        print(f"  attestation #{nft_id}   : owner={owner}")
        print(f"    mintedAmount  : {minted_rec}")
        print(f"    coverageUsed  : {coverage_rec}")
        print(f"    priceTime     : {price_time}")
        print(f"    reserveTime   : {reserve_time}")
        print(f"    stampSummary  : {stamp_summary}")

        if owner.lower() != recipient.lower():
            failures.append(f"attestation owner {owner} != recipient {recipient}")
        if minted_rec != delta_bal:
            failures.append(
                f"record.mintedAmount {minted_rec} != balance delta {delta_bal}")
        if int(coverage_rec) != wei_exact(reported_justified):
            findings.append(
                f"D2 also affects mintAttestation: record.coverageUsed is "
                f"{coverage_rec}, Decimal-exact would be "
                f"{wei_exact(reported_justified)} "
                f"(difference {wei_exact(reported_justified) - int(coverage_rec)} wei).")

        # The record's times must be the OBSERVATION times, not the mint time.
        prices = [e for e in payload["edges"] if e["type"] == "HasPrice"]
        reserves = [e for e in payload["edges"] if e["type"] == "HasReserve"]
        if prices and int(price_time) != int(prices[0]["target"]["timestamp"]):
            failures.append(
                f"record.priceTime {price_time} != price node timestamp "
                f"{prices[0]['target']['timestamp']}")
        if reserves and int(reserve_time) != int(reserves[0]["target"]["timestamp"]):
            failures.append(
                f"record.reserveTime {reserve_time} != reserve node timestamp "
                f"{reserves[0]['target']['timestamp']}")
        stamps = json.loads(stamp_summary)
        if stamps != {"Freshness": "green", "Cover": "green", "Auditor": "green"}:
            failures.append(f"record.stampSummary is {stamps}, expected three greens")
    except Exception as exc:
        failures.append(f"could not read the attestation record: {exc}")

    # --- 7.7 explorer links --------------------------------------------------
    print("\n[7/9] Explorer links")
    explorer = EXPLORERS.get(chain_id)
    if explorer:
        print(f"  {explorer}/tx/{tx_hash}")
        print(f"  {explorer}/token/{token_addr}")
        print(f"  {explorer}/token/{att_addr}?a={nft_id}")
    else:
        print(f"  no explorer on this chain (chain {chain_id}) - the hash is the record")
        print(f"  tx hash : {tx_hash}")
        print(f"  token   : {token_addr}")
        print(f"  attest. : {att_addr}")

    # --- 7.8 refusal paths ---------------------------------------------------
    print("\n[8/9] Refusal paths do not broadcast")
    for path, label in (("yellow", "yellow (flat reserve)"),
                        ("unknown", "unknown (child missing)")):
        block_before = w3.eth.block_number
        try:
            rt.post_walker("DemoControl", {"path": path}, node_id)
            envelope = rt.post_walker("Act", {
                "requested_amount": REQUESTED_AMOUNT,
                "recipient": recipient,
                "token_address": token_addr,
                "attestation_address": att_addr,
            }, node_id)
            refusal = (rt.reports_of(envelope) or [{}])[0]
        except Exception as exc:
            failures.append(f"{path}: Act raised {type(exc).__name__}: {exc}")
            continue
        block_after = w3.eth.block_number
        minted = bool(refusal.get("minted"))
        print(f"  {label:<28} minted={minted} reason={refusal.get('reason')!r} "
              f"blocks {block_before}->{block_after}")
        if minted:
            failures.append(f"{path}: Act minted on a non-green path - invariant I7 broken")
        if block_after != block_before:
            failures.append(
                f"{path}: a block was produced ({block_before}->{block_after}) - "
                f"something was broadcast on a refusal path")
        if refusal.get("tx"):
            failures.append(f"{path}: Act returned a tx hash {refusal.get('tx')!r} on refusal")

    rt.stop_server(proc)

    # --- 7.9 summary ---------------------------------------------------------
    _summary(chain_label, failures, findings, verdict, {
        "chain": chain_label, "minted": minted_amount, "justified": reported_justified,
        "tx": tx_hash, "nft": nft_id,
        "explorer": explorer or "no explorer on this chain",
    })
    if failures or findings:
        return 1
    return 0


def _web3_version() -> str:
    try:
        import web3
        return web3.__version__
    except Exception:
        return "unknown"


def _summary(chain_label, failures, findings, verdict, block) -> None:
    print("\n[9/9] Summary")
    if block:
        print(f"""
  CHAIN:         {block['chain']}
  MINTED:        {block['minted']}
  JUSTIFIED:     {block['justified']}
  REQUESTED:     {REQUESTED_AMOUNT}
  SIZED BECAUSE: min(requested, justified) = {block['minted']}
  TX:            {block['tx']}
  NFT:           {block['nft']}
  EXPLORER:      {block['explorer']}""")

    if findings:
        print(f"\n  PRODUCT DEFECTS CONFIRMED ON CHAIN ({len(findings)}):")
        for finding in findings:
            print(f"    - {finding}")
    if failures:
        print(f"\n  {FAIL}: {len(failures)} assertion(s) did not hold:")
        for failure in failures:
            print(f"    - {failure}")

    print("\n" + "=" * 74)
    if failures or findings:
        verdict = FAIL
        print(f"RESULT: {FAIL} on {chain_label} - see the defects above.")
    else:
        print(f"RESULT: {PASS} on {chain_label} - every assertion held.")
    print("=" * 74)


def _tail(path: str, lines: int = 25) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return "".join(handle.readlines()[-lines:])
    except OSError:
        return "(no log)"


if __name__ == "__main__":
    sys.exit(main())
