#!/usr/bin/env python
"""
Phase 1.6 — fresh-boot isolation.

The "is the localhost working correctly" confirmation. Where the other scripts
check things that are already running, this one proves the system comes up
correctly FROM NOTHING: it drops the store, boots the server, seeds, and reads
the graph back. A server that only works because of state left behind by an
earlier run is not a working server.

    1. Kill any running jac process.
    2. Drop the project's database (the only reset that clears the graph — see
       docs/demo-runbook.md; `rm -rf .jac/data` resets nothing).
    3. Start `jac run jac/main.jac --no-client` in the background.
    4. Wait up to 30 seconds for /healthz to return 200.
    5. Run the seed.
    6. POST /walker/GetAsset/{node_id}.
    7. Assert the response is well-formed and carries ZERO edges. `SeedAsset`
       creates the Asset node and nothing else — no Liability, no observations.
       The Liability is created by `Ingest`, which the demo's three paths reach
       through `DemoControl`. On a freshly dropped store the graph is therefore
       exactly one node and no edges, and ANY edge here means the reset did not
       actually clear the graph. That is the failure this step exists to catch.
    8. Kill the jac process.

Note (prompt gap, recorded in Audit/AUDIT.md): the audit prompt specified
"exactly one HasLiability entry — the seed creates only Asset + Liability". That
expectation is wrong; `SeedAsset` creates no edges at all. Verified by reading
jac/walkers/seed_asset.jac and by this script's own run. The assertion below is
the corrected one, and it is strictly stronger: zero edges catches everything the
old expectation would have, and also catches a stale Asset with leftover stamps.

Run with the project venv, which is where `requests` and `python-dotenv` live:

    .jac/venv/bin/python scripts/health_check.py

Exits 0 on success, non-zero naming the step that failed.
"""
import sys

import _runtime as rt

PASS = "PASS"
FAIL = "FAIL"


def main() -> int:
    print("=" * 72)
    print("PHASE 1.6 — FRESH-BOOT ISOLATION")
    print("=" * 72)

    # --- 1 & 2: stop everything, then drop the store ------------------------
    print("\n[1/8] Stopping any running jac process...")
    try:
        dropped = rt.reset_store()
    except Exception as exc:
        print(f"  {FAIL}: could not reset the store: {exc}")
        return 1
    print(f"  {PASS}: store reset (dropped database {dropped})")

    # The drop is only real if the database is gone. `jac db list` reporting no
    # databases here is the confirmation — without it, a cwd mistake would look
    # exactly like a successful reset.
    print("\n[2/8] Confirming the store is actually empty...")
    try:
        still_there = rt.project_database()
        print(f"  {FAIL}: database {still_there} still listed after the drop")
        return 1
    except RuntimeError:
        print(f"  {PASS}: `jac db list` reports no database")

    # --- 3 & 4: boot and wait for readiness ---------------------------------
    print(f"\n[3/8] Starting `jac run {rt.ENTRY_POINT} --no-client`...")
    log_path = "/tmp/porje_health_check_server.log"
    proc = rt.start_server(log_path=log_path)
    print(f"  {PASS}: started (pid {proc.pid}), stdout -> {log_path}")

    print(f"\n[4/8] Waiting up to {rt.HEALTH_TIMEOUT_SECONDS}s for /healthz...")
    if not rt.wait_for_healthz():
        print(f"  {FAIL}: /healthz never returned 200")
        print(f"  server log tail:\n{_tail(log_path)}")
        rt.stop_server(proc)
        return 1
    print(f"  {PASS}: /healthz returned 200")

    # --- 5: seed -------------------------------------------------------------
    print("\n[5/8] Seeding the graph...")
    try:
        node_id = rt.seed_asset()
    except Exception as exc:
        print(f"  {FAIL}: seed failed: {exc}")
        print(f"  server log tail:\n{_tail(log_path)}")
        rt.stop_server(proc)
        return 1
    print(f"  {PASS}: asset node id = {node_id}")

    # --- 6 & 7: read back, and assert the graph is exactly what the seed made -
    print(f"\n[6/8] POST /walker/GetAsset/{node_id}...")
    try:
        payload = rt.get_asset(node_id)
    except Exception as exc:
        print(f"  {FAIL}: GetAsset failed: {exc}")
        rt.stop_server(proc)
        return 1
    print(f"  {PASS}: response is well-formed (id={payload.get('id')!r}, "
          f"node_id={payload.get('node_id')!r})")

    print("\n[7/8] Asserting the graph contains zero edges (Asset only)...")
    counts = {}
    for edge in payload.get("edges", []):
        counts[edge.get("type")] = counts.get(edge.get("type"), 0) + 1
    print(f"  edge counts: {counts or '{}'}")
    if counts:
        print(f"  {FAIL}: expected no edges on a fresh boot, found {counts}")
        print("  A freshly dropped store contains the seeded Asset and nothing "
              "else. Any edge means the reset did not clear the graph — which is "
              "exactly the failure `rm -rf .jac/data` would produce, since that "
              "resets nothing.")
        rt.stop_server(proc)
        return 1
    print(f"  {PASS}: zero edges — the store held only the seeded Asset")

    # --- 8: stop -------------------------------------------------------------
    print("\n[8/8] Stopping the server...")
    rt.stop_server(proc)
    print(f"  {PASS}: stopped")

    print("\n" + "=" * 72)
    print("RESULT: PASS — the server boots correctly from an empty store.")
    print("=" * 72)
    return 0


def _tail(path: str, lines: int = 25) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return "".join(handle.readlines()[-lines:])
    except OSError:
        return "(no log)"


if __name__ == "__main__":
    sys.exit(main())
