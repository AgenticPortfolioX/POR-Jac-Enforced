#!/usr/bin/env python
"""
Phase 5.12 - the sizing table.

"Isn't there supposed to be a calculation by Jac to size the trade?" This script
is the answer to that question, and its printed table is the evidence.

WHAT IT DOES

The formula in §11 is:

    coverage_value  = reserve.amount * price.value
    liability_value = (minted_units + demo_position) * price.value
    ratio           = coverage_value / liability_value
    justified       = max(0, coverage_value / price.value - minted_units - demo_position)

Note that `price.value` cancels in both `ratio` and `justified`: sizing is
denominated in RESERVE UNITS, not in price units (§11 P1/P2). The expected
column below is therefore computed here, independently, as

    justified = reserve - minted - demo
    ratio     = reserve / (minted + demo)

which is the same quantity with the cancellation already applied. Computing it
this way rather than by mirroring the walker's own expression is deliberate: an
expectation copied from the implementation proves only that the implementation
equals itself.

The `actual` column comes from spawning the REAL `Cover` walker.

WHY THERE IS A GENERATED JAC FILE

Two documented constraints on this script (§ Phase 5, C1 and C2):

  C1  Cases with a non-zero `demo_position`, or a zero liability, CANNOT be
      expressed over HTTP: `Ingest` hardcodes `minted_units = 1_000_000.0` and
      `demo_position = 0.0`, and no endpoint accepts arbitrary reserve/price/
      liability values. So those cases are constructed in-process, in a Jac
      harness this script writes, runs, and deletes.
  C2  The mint spy patches the module object `jac.lib.evm_py`, which an HTTP
      request dispatched to a separate server process cannot reach. So the Act
      cases are also in-process, and are reported here rather than re-run over
      the wire.

The harness writes its rows to a FILE rather than to stdout, because `jac test`
captures stdout internally - a `print` inside a test is invisible to the runner.
That is a measured property of this toolchain, not a preference: see Phase 4.1.

Neither constraint is worked around silently. Both are recorded as limitations
of the current API surface in Audit/AUDIT.md.

Run with any Python that has the project's venv on the `jac` path:

    .jac/venv/bin/python scripts/verify_sizing.py
"""
import os
import sys

import _runtime as rt

PASS = "PASS"
FAIL = "FAIL"

HARNESS_REL = "jac/tests/_audit_sizing_harness_tests.jac"
ROWS_PATH = "/tmp/porje_sizing_rows.txt"

# Tolerances. `justified` values are O(1e6) and float64 carries ~1e-10 relative
# error at that magnitude; `ratio` values are O(1). Both tolerances are far
# tighter than any real defect would produce (D2's error is ~4e12 wei).
JUSTIFIED_TOLERANCE = 0.01
RATIO_TOLERANCE = 1e-6

# The § Phase 5 case table. `demo` is the demo_position.
#
# Case 5.7 appears TWICE. The prompt's row reads "reserve 1_500_000 ... ratio
# 0.6667", and those two statements are not consistent: with reserve 1_500_000
# the ratio is 1.0, and 0.6667 requires reserve 1_000_000. Both readings are run
# and reported, because the point of the row - that `demo_position` is counted,
# not silently ignored - is only demonstrated by whichever reading actually
# distinguishes a demo-aware walker from a demo-blind one. That is 5.7a: a walker
# ignoring demo_position would report justified 500_000 there, and the code
# reports 0.0. See Audit/AUDIT.md, "prompt gaps".
SIZING_CASES = [
    # id,        reserve,     price, minted,      demo,      expect_color, expect_justified, expect_ratio
    ("5.2",  1_000_000.0, 1.0, 1_000_000.0,       0.0,      "green",  0.0,       1.0),
    ("5.3",  1_500_000.0, 1.0, 1_000_000.0,       0.0,      "green",  500_000.0, 1.5),
    ("5.4",    970_000.0, 1.0, 1_000_000.0,       0.0,      "caution", 0.0,       0.97),
    ("5.5",    900_000.0, 1.0, 1_000_000.0,       0.0,      "red",    0.0,       0.90),
    ("5.6",  1_500_000.0, 2.0, 1_000_000.0,       0.0,      "green",  500_000.0, 1.5),
    ("5.7a", 1_500_000.0, 1.0, 1_000_000.0, 500_000.0,      "green",  0.0,       1.0),
    ("5.7b", 1_000_000.0, 1.0, 1_000_000.0, 500_000.0,      "red",    0.0,       2.0 / 3.0),
    ("5.8",  1_000_000.0, 1.0,         0.0,       0.0,      "red",    1_000_000.0, 0.0),
    ("5.9",          0.0, 1.0, 1_000_000.0,       0.0,      "red",    0.0,       0.0),
]

# 5.11 - the same logical setup at three prices. Reserve, minted and demo are
# held fixed, so both justified and ratio must be identical across all three.
PRICE_INDEPENDENCE_CASES = [
    ("5.11@p0.5", 1_500_000.0, 0.5, 1_000_000.0, 0.0),
    ("5.11@p1.0", 1_500_000.0, 1.0, 1_000_000.0, 0.0),
    ("5.11@p2.0", 1_500_000.0, 2.0, 1_000_000.0, 0.0),
]

# 5.10 - Act mints exactly min(requested, justified).
# (requested, reserve, minted, demo, expect_mint_calls, expect_amount_arg)
ACT_CASES = [
    (100.0,     1_500_000.0, 1_000_000.0, 0.0, 1, 100.0),
    (500_000.0, 1_500_000.0, 1_000_000.0, 0.0, 1, 500_000.0),
    (900_000.0, 1_500_000.0, 1_000_000.0, 0.0, 1, 500_000.0),  # capped
    (1_000_000.0, 1_000_000.0, 1_000_000.0, 0.0, 0, None),      # justified 0
    (0.0,       1_500_000.0, 1_000_000.0, 0.0, 0, None),
    (-100.0,    1_500_000.0, 1_000_000.0, 0.0, 0, None),
]

HARNESS = '''\
# GENERATED by scripts/verify_sizing.py - do not edit, do not commit.
#
# Phase 5.12's in-process half. Every case builds the graph directly and spawns
# the REAL Cover (and, for 5.10, the real Act), because Ingest hardcodes the
# liability and therefore cannot express these cases over HTTP (constraint C1).
#
# Rows are appended to a file because `jac test` captures stdout.

import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy, MintedAs }
import from jac.walkers.freshness { Freshness }
import from jac.walkers.cover { Cover }
import from jac.walkers.auditor { Auditor }
import from jac.walkers.act { Act }
import from jac.lib.utils { now_unix }
import from jac.tests.spy_bridge { spy_install, spy_uninstall, spy_reset, spy_mint_call_count, spy_last_mint_args }
import os;

glob ROWS = "%(rows_path)s";

def emit(line: str) {
    f = open(ROWS, "a");
    f.write(line + "\\n");
    f.close();
}

# Build one asset with a complete, fresh, present observation set. The child is
# present and 5 seconds old and flat_history is empty, so the ONLY driver of the
# verdict in these cases is the coverage arithmetic.
def sized(asset_id: str, price: float, reserve: float, minted: float, demo: float) -> Asset {
    now = now_unix();
    a = Asset(id=asset_id, name="SizingAudit", symbol="SA", chain="test",
              token_address="0x0", overall_status="unknown", created_at=0);
    root ++> a;
    p = PriceObservation(value=price, timestamp=now-5, source="fixture",
                         provenance="audit", round_id=1);
    r = ReserveAttestation(amount=reserve, timestamp=now-5, source="fixture",
                           provenance="audit", feed_address="0x0", round_id=1,
                           answered_in_round=1, flat_history=[]);
    l = Liability(minted_units=minted, vault_shares=0.0, demo_position=demo,
                  description="audit");
    c = ChildClaim(asset_id="USDC", amount=reserve, timestamp=now-5,
                   source="fixture", present=True, provenance="audit");
    a +>: HasPrice() :+> p;
    a +>: HasReserve() :+> r;
    a +>: HasLiability() :+> l;
    r +>: DependsOn() :+> c;
    return a;
}

# --- the case table ---------------------------------------------------------
def run_sizing_case(case_id: str, reserve: float, price: float, minted: float, demo: float) {
    a = sized("audit-sizing-" + case_id, price, reserve, minted, demo);
    r = a spawn Cover();
    rep = r.reports[0];
    emit("SIZING|" + case_id + "|" + str(reserve) + "|" + str(price) + "|" + str(minted)
         + "|" + str(demo) + "|" + str(rep["color"]) + "|" + str(rep["justified_amount"])
         + "|" + str(rep["coverage_ratio"]));
}

test "audit_sizing_case_table" {
%(sizing_calls)s}

test "audit_sizing_price_independence" {
%(price_calls)s}

# --- 5.10: Act mints exactly min(requested, justified) ----------------------
# Each case builds a fresh fully-approved asset, then spawns the real Act under
# the mint spy. The ceiling Cover computed is emitted alongside what Act did, so
# the min() decision can be checked against the walker's own number rather than
# against a number restated here.
def run_act_case(asset_id: str, requested: float, reserve: float, minted: float, demo: float) {
    a = sized(asset_id, 1.0, reserve, minted, demo);
    a spawn Freshness();
    a spawn Cover();
    a spawn Auditor();

    stamps = [s for s in [a ->:StampedBy:->] if str(s.walker_name) == "Cover"];
    ceiling = float(stamps[0].payload["justified_amount"]);

    spy_reset();
    spy_install();
    r = a spawn Act(requested_amount=requested, recipient="0x1234",
                    token_address="0xTOKEN", attestation_address="0xATT");
    calls = spy_mint_call_count();
    args = spy_last_mint_args();
    spy_uninstall();
    spy_reset();

    arg_amount = "";
    if len(args) > 2 {
        arg_amount = str(args[2]);
    }
    rep = r.reports[0];
    # A successful mint carries no "reason" key - Act only sets it on refusal.
    emit("ACT|" + str(requested) + "|" + str(ceiling) + "|" + str(calls) + "|"
         + arg_amount + "|" + str(rep["minted"]) + "|" + str(rep.get("reason", ""))
         + "|" + str(len([a ->:MintedAs:->])));
}

test "audit_act_min_requested_justified" {
%(act_calls)s}
'''


def build_harness() -> str:
    sizing_calls = "".join(
        f'    run_sizing_case("{cid}", {reserve!r}, {price!r}, {minted!r}, {demo!r});\n'
        for cid, reserve, price, minted, demo, *_ in SIZING_CASES
    )
    price_calls = "".join(
        f'    run_sizing_case("{cid}", {reserve!r}, {price!r}, {minted!r}, {demo!r});\n'
        for cid, reserve, price, minted, demo in PRICE_INDEPENDENCE_CASES
    )
    act_calls = "".join(
        f'    run_act_case("audit-act-{index}", {req!r}, {reserve!r}, {minted!r}, {demo!r});\n'
        for index, (req, reserve, minted, demo, _calls, _arg) in enumerate(ACT_CASES)
    )
    return HARNESS % {
        "rows_path": ROWS_PATH,
        "sizing_calls": sizing_calls,
        "price_calls": price_calls,
        "act_calls": act_calls,
    }


def run_harness() -> tuple[int, dict]:
    """Write the harness, run it, read its rows back. Returns (exit code, rows)."""
    harness_path = os.path.join(rt.PROJECT_ROOT, HARNESS_REL)
    os.makedirs(os.path.dirname(harness_path), exist_ok=True)
    with open(harness_path, "w", encoding="utf-8") as handle:
        handle.write(build_harness())

    try:
        if os.path.exists(ROWS_PATH):
            os.remove(ROWS_PATH)

        result = rt.jac("test", HARNESS_REL, timeout=600)
        print("  harness stdout tail:")
        for line in (result.stdout or "").splitlines()[-6:]:
            print(f"    {line}")
        if result.returncode != 0:
            print("  harness stderr tail:")
            for line in (result.stderr or "").splitlines()[-15:]:
                print(f"    {line}")

        rows: dict = {"SIZING": {}, "ACT": []}
        if os.path.exists(ROWS_PATH):
            with open(ROWS_PATH, "r", encoding="utf-8") as handle:
                for line in handle:
                    parts = line.rstrip("\n").split("|")
                    if parts[0] == "SIZING" and len(parts) >= 9:
                        rows["SIZING"][parts[1]] = {
                            "reserve": float(parts[2]), "price": float(parts[3]),
                            "minted": float(parts[4]), "demo": float(parts[5]),
                            "color": parts[6], "justified": float(parts[7]),
                            "ratio": float(parts[8]),
                        }
                    elif parts[0] == "ACT" and len(parts) >= 8:
                        rows["ACT"].append({
                            "requested": float(parts[1]), "ceiling": float(parts[2]),
                            "calls": int(parts[3]),
                            "arg": float(parts[4]) if parts[4] else None,
                            "minted": parts[5], "reason": parts[6],
                            "records": int(parts[7]),
                        })
        return result.returncode, rows
    finally:
        for path in (harness_path, ROWS_PATH):
            try:
                os.remove(path)
            except OSError:
                pass


def fmt(value: float) -> str:
    """Trim trailing zeros so 500000.0 prints as 500000 and 0.6667 stays legible."""
    text = f"{value:.6f}".rstrip("0").rstrip(".")
    return text or "0"


def main() -> int:
    print("=" * 78)
    print("PHASE 5.12 - SIZING TABLE")
    print("=" * 78)
    print("\nRunning the in-process harness (constraints C1/C2 - see the docstring)...")

    exit_code, rows = run_harness()
    if not rows["SIZING"] and not rows["ACT"]:
        print(f"\n{FAIL}: the harness produced no rows (jac test exit {exit_code}).")
        print("  Nothing is asserted below, because there is nothing to assert on.")
        return 1

    failures: list = []

    # --- the case table ------------------------------------------------------
    print("\n" + "-" * 78)
    print("SIZING CASES - expected is computed independently with the price cancelled")
    print("-" * 78)
    header = f"{'case':<9} {'reserve':>10} {'price':>6} {'minted':>10} {'demo':>7}  " \
             f"{'expected':>28}  {'actual':>26}  {'':<4}"
    print(header)
    print("-" * 78)

    for cid, reserve, price, minted, demo, exp_color, exp_just, exp_ratio in SIZING_CASES:
        row = rows["SIZING"].get(cid)
        expected = f"{exp_color}, j={fmt(exp_just)}, r={fmt(exp_ratio)}"
        if row is None:
            failures.append(f"{cid}: no row emitted by the harness")
            print(f"{cid:<9} {fmt(reserve):>10} {fmt(price):>6} {fmt(minted):>10} "
                  f"{fmt(demo):>7}  {expected:>28}  {'MISSING':>26}  {FAIL}")
            continue

        actual = f"{row['color']}, j={fmt(row['justified'])}, r={fmt(row['ratio'])}"
        ok = (
            row["color"] == exp_color
            and abs(row["justified"] - exp_just) <= JUSTIFIED_TOLERANCE
            and abs(row["ratio"] - exp_ratio) <= RATIO_TOLERANCE
        )
        if not ok:
            failures.append(
                f"{cid}: expected {expected}, got {actual}")
        print(f"{cid:<9} {fmt(reserve):>10} {fmt(price):>6} {fmt(minted):>10} "
              f"{fmt(demo):>7}  {expected:>28}  {actual:>26}  "
              f"{PASS if ok else FAIL:<4}")

    # --- 5.11 price independence --------------------------------------------
    print("\n" + "-" * 78)
    print("5.11 PRICE INDEPENDENCE - reserve/minted/demo fixed, price varied")
    print("-" * 78)
    price_rows = [(cid, rows["SIZING"].get(cid)) for cid, *_ in PRICE_INDEPENDENCE_CASES]
    missing = [cid for cid, row in price_rows if row is None]
    if missing:
        failures.append(f"5.11: no rows for {missing}")
        print(f"  {FAIL}: missing rows for {missing}")
    else:
        for cid, row in price_rows:
            print(f"  {cid:<12} j={fmt(row['justified']):<12} r={fmt(row['ratio'])}")
        justifieds = [row["justified"] for _cid, row in price_rows]
        ratios = [row["ratio"] for _cid, row in price_rows]
        spread_j = max(justifieds) - min(justifieds)
        spread_r = max(ratios) - min(ratios)
        print(f"  spread across the three prices: justified {spread_j:.3e}, ratio {spread_r:.3e}")
        if spread_j > JUSTIFIED_TOLERANCE:
            failures.append(f"5.11: justified varies with price by {spread_j}")
        if spread_r > RATIO_TOLERANCE:
            failures.append(f"5.11: ratio varies with price by {spread_r}")
        if spread_j <= JUSTIFIED_TOLERANCE and spread_r <= RATIO_TOLERANCE:
            print(f"  {PASS}: both quantities are invariant under price - the pricing "
                  f"cancels and sizing is in reserve units")

    # --- 5.10 Act min(requested, justified) ---------------------------------
    print("\n" + "-" * 78)
    print("5.10 Act MINTS EXACTLY min(requested, justified)  [in-process, per C2]")
    print("-" * 78)
    print(f"  {'requested':>12} {'ceiling':>12} {'mint calls':>11} {'amount arg':>12} "
          f"{'minted':>7}  {'MintedAs':>8}  verdict")
    act_rows = rows["ACT"]
    if len(act_rows) != len(ACT_CASES):
        failures.append(
            f"5.10: harness emitted {len(act_rows)} Act rows, expected {len(ACT_CASES)}")
    for index, (req, reserve, minted, demo, exp_calls, exp_arg) in enumerate(ACT_CASES):
        if index >= len(act_rows):
            print(f"  {fmt(req):>12} {'-':>12} {'MISSING':>11}")
            continue
        row = act_rows[index]
        if exp_calls == 0:
            ok = row["calls"] == 0 and row["minted"] == "False" and row["records"] == 0
            verdict = f"refused: {row['reason']}"
        else:
            ok = (row["calls"] == 1 and row["arg"] is not None
                  and abs(row["arg"] - exp_arg) <= JUSTIFIED_TOLERANCE
                  and row["minted"] == "True" and row["records"] == 1)
            verdict = f"minted {fmt(row['arg']) if row['arg'] is not None else '-'}"
        if not ok:
            failures.append(
                f"5.10 requested={fmt(req)}: expected {exp_calls} calls"
                f"{'' if exp_arg is None else f' of {fmt(exp_arg)}'}, "
                f"got {row['calls']} calls arg={row['arg']} minted={row['minted']} "
                f"records={row['records']}")
        print(f"  {fmt(req):>12} {fmt(row['ceiling']):>12} {row['calls']:>11} "
              f"{(fmt(row['arg']) if row['arg'] is not None else '-'):>12} "
              f"{row['minted']:>7}  {row['records']:>8}  {PASS if ok else FAIL}  {verdict}")

    # --- summary -------------------------------------------------------------
    print("\n" + "=" * 78)
    if failures:
        print(f"RESULT: FAIL - {len(failures)} case(s) did not match:")
        for failure in failures:
            print(f"  - {failure}")
    else:
        print("RESULT: PASS - every sizing case matched the independently computed "
              "expectation,")
        print("        the pricing cancels under price changes, and Act mints exactly "
              "min(requested, justified).")
    print("=" * 78)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
