#!/usr/bin/env python
"""
Phase 3.6 - Chainlink proof-of-reserve feeds into the graph.

The claim under test is that a reserve attestation *enters the graph as a node
with provenance*, rather than being read at the moment someone asks a question.
That distinction is the whole product: a value that is only fetched on demand
has no history, cannot be stamped, and cannot be audited after the fact.

This script ingests each fixture into a fresh asset, reads the graph back over
HTTP with `GetAsset`, prints every node it finds with its source, timestamp and
value, and then asserts the shape of what it found:

    1. Server reachable (started here if not already running).
    2. Fixture mode, one fresh asset per fixture: por_live, por_stale, por_flat.
    3. Live mode - only if the two feed addresses are configured. If they are
       not, the script runs the NEGATIVE case instead (empty addresses must
       write nothing and report an error) rather than skipping silently.
    4. Wiring: `HasPrice` and `HasReserve` run Asset -> observation, and
       `DependsOn` runs RESERVE -> child. The DependsOn direction is the one
       worth checking: hanging the child off the Asset would still render, and
       would still make Cover's child-age check read a timestamp, but it would
       describe the wrong relationship.

Exits non-zero on any failed assertion.

Run with the project venv, which is where `requests` lives:

    .jac/venv/bin/python scripts/verify_por_feeds.py
"""
import json
import os
import sys
import time
from dotenv import load_dotenv

load_dotenv()

import _runtime as rt

PASS = "PASS"
FAIL = "FAIL"

FIXTURES_DIR = os.path.join(rt.PROJECT_ROOT, "fixtures")

# Ingest derives its sub-fixtures from the stem of `fixture_name` (§12.1):
# `por_live` -> stem `live` -> price_live, child_live. A missing sub-fixture is
# not an error; Ingest falls back (price_live for the price, an inline
# present/1250000 claim for the child). These two sets exist so the resolution
# below can be checked against the directory listing rather than assumed.
FIXTURE_CASES = ("por_live", "por_stale", "por_flat")


def load_fixture(name: str) -> dict | None:
    """Read a fixture file, or None if it does not exist (the fallback trigger)."""
    path = os.path.join(FIXTURES_DIR, f"{name}.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def expected_shape(fixture_name: str) -> dict:
    """
    What §12.1 says Ingest will produce for this fixture, resolved through the
    documented fallback rules.

    This is deliberately computed from the fixture FILES rather than hardcoded,
    so that editing a fixture without editing the walker shows up here.
    """
    stem = fixture_name.split("_")[-1]

    price = load_fixture(f"price_{stem}") or load_fixture("price_live")
    if price is None:
        raise RuntimeError(f"no price fixture for {fixture_name} and no price_live fallback")

    reserve = load_fixture(fixture_name)
    if reserve is None:
        raise RuntimeError(f"reserve fixture {fixture_name} is missing")

    child = load_fixture(f"child_{stem}")
    child_is_inline = child is None
    if child_is_inline:
        # The inline default Ingest substitutes when no child fixture exists.
        child = {
            "asset_id": "USDC",
            "amount": 1250000.0,
            "present": True,
            "source": "fixture",
            "provenance": "inline",
        }

    return {
        "price_value": float(price["value"]),
        "price_offset": int(price["timestamp_offset_seconds"]),
        "reserve_amount": float(reserve["amount"]),
        "reserve_offset": int(reserve["timestamp_offset_seconds"]),
        "reserve_round": int(reserve.get("round_id", 0)),
        "flat_history_len": len(reserve.get("flat_history", [])),
        "child_present": bool(child["present"]),
        "child_amount": float(child["amount"]),
        "child_offset": int(child.get("timestamp_offset_seconds", -30)),
        "child_is_inline": child_is_inline,
    }


def ingest(node_id: str, **params) -> dict:
    """POST Ingest at the asset node and return the report."""
    body = {"use_fixture": True, "fixture_name": "por_live", "child_asset_id": "USDC"}
    body.update(params)
    reports = rt.require_ok(rt.post_walker("Ingest", body, node_id), "Ingest")
    if not reports:
        raise RuntimeError("Ingest returned no report")
    return reports[0]


def nodes_of(payload: dict) -> dict:
    """Group GetAsset's flat edge list into {type: [target, ...]}."""
    grouped: dict = {}
    for edge in payload.get("edges", []):
        grouped.setdefault(edge["type"], []).append(edge)
    return grouped


def print_nodes(label: str, payload: dict) -> None:
    """Print every ingested node with its source, timestamp and value."""
    grouped = nodes_of(payload)
    now = int(time.time())
    print(f"  nodes on the asset after Ingest({label}):")

    for edge in grouped.get("HasPrice", []):
        t = edge["target"]
        print(f"    HasPrice    -> PriceObservation     "
              f"value={t['value']!r:<12} src={t['source']:<8} ts={t['timestamp']} "
              f"(age {now - t['timestamp']}s) round={t['round_id']}")

    for edge in grouped.get("HasReserve", []):
        t = edge["target"]
        print(f"    HasReserve  -> ReserveAttestation   "
              f"amount={t['amount']!r:<12} src={t['source']:<8} ts={t['timestamp']} "
              f"(age {now - t['timestamp']}s) round={t['round_id']}")

    for edge in grouped.get("DependsOn", []):
        t = edge["target"]
        print(f"    DependsOn   -> ChildClaim           "
              f"amount={t['amount']!r:<12} src={t['source']:<8} ts={t['timestamp']} "
              f"(age {now - t['timestamp']}s) present={t['present']}")

    for edge in grouped.get("HasLiability", []):
        t = edge["target"]
        print(f"    HasLiability-> Liability            "
              f"minted={t['minted_units']!r} demo={t['demo_position']!r} "
              f"vault={t['vault_shares']!r}")

    stamps = grouped.get("StampedBy", [])
    print(f"    (StampedBy: {len(stamps)} - expected 0, Ingest stamps nothing)")


def check_fixture_case(fixture_name: str) -> list:
    """One fixture: fresh asset, ingest, read back, assert. Returns failure list."""
    failures: list = []
    expect = expected_shape(fixture_name)

    asset_id = f"feeds-{fixture_name}"
    node_id = rt.seed_asset(asset_id=asset_id, name=f"Feeds {fixture_name}",
                            symbol=fixture_name.upper())
    report = ingest(node_id, use_fixture=True, fixture_name=fixture_name)
    payload = rt.get_asset(node_id)

    print(f"\n  Ingest report: {report}")
    print_nodes(fixture_name, payload)

    grouped = nodes_of(payload)

    # --- exactly the documented node set ------------------------------------
    for edge_type, expected_count in (("HasPrice", 1), ("HasReserve", 1),
                                      ("HasLiability", 1), ("DependsOn", 1)):
        actual = len(grouped.get(edge_type, []))
        if actual != expected_count:
            failures.append(f"{fixture_name}: {edge_type} count {actual} != {expected_count}")

    # Ingest stamps nothing. A stamp here would mean an observation arrived
    # pre-approved, which is exactly the thing the approval walkers exist to
    # prevent.
    stamps = len(grouped.get("StampedBy", []))
    if stamps != 0:
        failures.append(f"{fixture_name}: Ingest created {stamps} stamps (expected 0)")

    if not grouped.get("HasPrice") or not grouped.get("HasReserve") or not grouped.get("DependsOn"):
        return failures  # nothing further to compare; the counts above say why

    price = grouped["HasPrice"][0]["target"]
    reserve = grouped["HasReserve"][0]["target"]
    child = grouped["DependsOn"][0]["target"]

    # --- not an empty success: the nodes carry real values -------------------
    if price["value"] != expect["price_value"]:
        failures.append(
            f"{fixture_name}: price value {price['value']} != {expect['price_value']}")
    if reserve["amount"] != expect["reserve_amount"]:
        failures.append(
            f"{fixture_name}: reserve amount {reserve['amount']} != {expect['reserve_amount']}")

    # --- provenance: fixture data is never costumed as live (§3.3) -----------
    for name, node in (("price", price), ("reserve", reserve), ("child", child)):
        if node["source"] != "fixture":
            failures.append(
                f"{fixture_name}: {name} source is {node['source']!r}, expected 'fixture'")

    # --- timestamps are the feed's, not the ingest moment (§3.5) -------------
    now = int(time.time())
    for name, node, offset in (("price", price, expect["price_offset"]),
                               ("reserve", reserve, expect["reserve_offset"]),
                               ("child", child, expect["child_offset"])):
        age = now - node["timestamp"]
        if abs(age - abs(offset)) > 5:
            failures.append(
                f"{fixture_name}: {name} age {age}s does not match fixture offset "
                f"{offset}s (tolerance 5s) - the timestamp was overwritten at ingest")

    # --- child present matches the fixture -----------------------------------
    if bool(child["present"]) != expect["child_present"]:
        failures.append(
            f"{fixture_name}: child present={child['present']} != {expect['child_present']}")

    # --- the wiring directions ----------------------------------------------
    # HasPrice/HasReserve have no "source" key: GetAsset builds them from the
    # asset under `here`, so their source is the asset by construction. The
    # DependsOn edge is the one that carries an explicit source, and it must be
    # the RESERVE's id.
    depends = grouped["DependsOn"][0]
    if depends.get("source") != reserve["id"]:
        failures.append(
            f"{fixture_name}: DependsOn source {depends.get('source')!r} is not the "
            f"reserve id {reserve['id']!r} - the child is hanging off the wrong node")

    return failures


def main() -> int:
    print("=" * 72)
    print("PHASE 3.6 - CHAINLINK PROOF-OF-RESERVE FEEDS INTO THE GRAPH")
    print("=" * 72)

    # --- 1: server -----------------------------------------------------------
    print("\n[1/4] Ensuring the server is reachable...")
    started = None
    if rt.wait_for_healthz(3):
        print(f"  {PASS}: a server is already answering at {rt.JAC_URL}")
    else:
        log_path = "/tmp/porje_verify_feeds_server.log"
        started = rt.start_server(log_path=log_path)
        if not rt.wait_for_healthz():
            print(f"  {FAIL}: could not reach {rt.JAC_URL} and the server did not start")
            print(f"  server log:\n{_tail(log_path)}")
            rt.stop_server(started)
            return 1
        print(f"  {PASS}: started a server (pid {started.pid}), log -> {log_path}")

    failures: list = []
    try:
        # --- 2: fixture mode, one fresh asset per fixture --------------------
        print(f"\n[2/4] Fixture mode: {', '.join(FIXTURE_CASES)}")
        for fixture_name in FIXTURE_CASES:
            print(f"\n  --- {fixture_name} " + "-" * (52 - len(fixture_name)))
            try:
                failures += check_fixture_case(fixture_name)
            except Exception as exc:
                failures.append(f"{fixture_name}: raised {type(exc).__name__}: {exc}")

        # --- 3: live mode, or the honest negative case ------------------------
        print("\n[3/4] Live mode...")
        price_feed = os.environ.get("PRICE_FEED_ADDRESS", "")
        reserve_feed = os.environ.get("RESERVE_FEED_ADDRESS", "")
        if price_feed and reserve_feed:
            print("  feeds are configured - running a real live ingest")
            try:
                node_id = rt.seed_asset(asset_id="feeds-live", name="Feeds Live", symbol="LIVE")
                report = ingest(node_id, use_fixture=False)
                payload = rt.get_asset(node_id)
                print(f"  Ingest report: {report}")
                print_nodes("live", payload)
                grouped = nodes_of(payload)
                if len(grouped.get("HasPrice", [])) != 1 or len(grouped.get("HasReserve", [])) != 1:
                    failures.append("live: expected one price and one reserve node")
                elif grouped["HasPrice"][0]["target"]["source"] != "live":
                    failures.append(
                        "live: price source is not 'live' - a fetch did not happen")
            except Exception as exc:
                failures.append(f"live ingest raised {type(exc).__name__}: {exc}")
        else:
            # Not configured. Fabricating a live node to make this branch look
            # green is the one thing this system must never do, so instead we
            # prove the negative: unconfigured feeds must write NOTHING (§3.2).
            missing = [k for k, v in (("PRICE_FEED_ADDRESS", price_feed),
                                      ("RESERVE_FEED_ADDRESS", reserve_feed)) if not v]
            print(f"  feeds NOT configured (unset: {', '.join(missing)})")
            print("  running the negative case instead: empty addresses must write nothing")
            try:
                node_id = rt.seed_asset(asset_id="feeds-live-neg", name="Feeds Neg",
                                        symbol="NEG")
                report = ingest(node_id, use_fixture=False, price_feed_address="",
                                reserve_feed_address="")
                payload = rt.get_asset(node_id)
                print(f"  Ingest report: {report}")
                grouped = nodes_of(payload)
                counts = {k: len(v) for k, v in grouped.items()}
                print(f"  node counts after the refused ingest: {counts or '{}'}")

                if report.get("error") != "feed_addresses_missing":
                    failures.append(
                        f"live-negative: expected error 'feed_addresses_missing', "
                        f"got {report.get('error')!r}")
                if counts:
                    failures.append(
                        f"live-negative: a refused ingest wrote nodes {counts} - this is "
                        f"the manufactured-fact failure this system must never have")
                else:
                    print(f"  {PASS}: refused with 'feed_addresses_missing' and wrote nothing")
            except Exception as exc:
                failures.append(f"live-negative raised {type(exc).__name__}: {exc}")

        # --- 4: summary -------------------------------------------------------
        print("\n[4/4] Summary")
        if failures:
            print(f"  {FAIL}: {len(failures)} failed assertion(s):")
            for failure in failures:
                print(f"    - {failure}")
        else:
            print(f"  {PASS}: every fixture produced exactly the documented nodes, "
                  f"all sourced 'fixture', timestamps intact, and the child wired "
                  f"to the reserve by DependsOn")
    finally:
        if started is not None:
            rt.stop_server(started)

    print("\n" + "=" * 72)
    print("RESULT: " + ("FAIL" if failures else "PASS"))
    print("=" * 72)
    return 1 if failures else 0


def _tail(path: str, lines: int = 25) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return "".join(handle.readlines()[-lines:])
    except OSError:
        return "(no log)"


if __name__ == "__main__":
    sys.exit(main())
