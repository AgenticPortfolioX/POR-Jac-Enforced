
# cover_edge_tests.jac
#
# Extended edge-case tests for the Cover walker.
#
# These tests exercise boundary conditions that the main cover_tests.jac
# does not reach:  exact threshold crossings, zero-liability edge cases,
# caution from flat reserve, stale child claim, and multi-run upsert
# correctness.

import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability, Stamp }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy }
import from jac.walkers.cover { Cover }
import from jac.lib.utils { now_unix }
import from jac.lib.policy { POLICY }


# --------------------------------------------------------------------------- #
# Helper: build a standard asset with live-shaped data
# --------------------------------------------------------------------------- #
def make_asset(id: str, reserve: float, price: float, minted: float,
               demo_pos: float, child_present: bool,
               child_age_offset: int, flat_history: list) -> Asset {
    now = now_unix();
    asset = Asset(
        id=id, name="CoverEdge", symbol="CE", chain="test",
        token_address="0x0", overall_status="unknown", created_at=0
    );
    root ++> asset;

    p = PriceObservation(
        value=price, timestamp=now - 10,
        source="fixture", provenance="test", round_id=1
    );
    r = ReserveAttestation(
        amount=reserve, timestamp=now - 10,
        source="fixture", provenance="test",
        feed_address="0x0", round_id=1, answered_in_round=1,
        flat_history=flat_history
    );
    c = ChildClaim(
        asset_id="USDC",
        amount=reserve,
        timestamp=now - child_age_offset,
        source="fixture",
        present=child_present,
        provenance="test"
    );
    l = Liability(
        minted_units=minted,
        vault_shares=0.0,
        demo_position=demo_pos,
        description="test"
    );

    asset +>: HasPrice()   :+> p;
    asset +>: HasReserve() :+> r;
    r     +>: DependsOn()  :+> c;
    asset +>: HasLiability() :+> l;

    return asset;
}


test "test_cover_caution_when_flat_reserve" {
    # A reserve feed that publishes the same amount across multiple windows
    # while the price changes is treated as CAUTION by Cover.
    flat_hist = [1250000.0, 1250000.0, 1250000.0, 1250000.0];
    asset = make_asset(
        "cover-flat", 1250000.0, 1.0002, 1000000.0, 0.0,
        True, 10, flat_hist
    );

    asset spawn Cover();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    # Flat reserve should produce at least caution
    verdict = str(stamps[0].color);
    assert verdict == "caution" or verdict == "red";
}


test "test_cover_unknown_when_no_data" {
    # An asset with no price, reserve, or liability attached should yield
    # COLOR_UNKNOWN - not an exception.
    asset = Asset(
        id="cover-no-data", name="Empty", symbol="MT", chain="test",
        token_address="0x0", overall_status="unknown", created_at=0
    );
    root ++> asset;
    asset spawn Cover();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    assert str(stamps[0].color) == "unknown";
}


test "test_cover_red_when_stale_child" {
    # A child claim that is older than child_max_age_seconds is treated as RED.
    child_max = int(POLICY["child_max_age_seconds"]);
    asset = make_asset(
        "cover-stale-child", 2500000.0, 1.0, 1000000.0, 1000000.0,
        True, child_max + 100, []
    );

    asset spawn Cover();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    assert str(stamps[0].color) == "red";
}


test "test_cover_upsert_does_not_accumulate_stamps" {
    # Running Cover twice on the same asset must still yield exactly one stamp.
    asset = make_asset(
        "cover-upsert", 2500000.0, 1.0, 1000000.0, 1000000.0,
        True, 10, []
    );

    asset spawn Cover();
    asset spawn Cover();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
}


test "test_cover_exact_min_coverage_boundary" {
    # At exactly min_coverage_ratio the verdict should be GREEN (>= not >).
    min_cov   = float(POLICY["min_coverage_ratio"]);  # 1.0 by default
    now = now_unix();

    # Set reserve and liability such that ratio is exactly min_cov.
    # reserve=2000000, price=1.0, minted=1000000, demo_pos=1000000
    # coverage_value = 2000000*1.0 = 2000000
    # liability_value = (1000000+1000000)*1.0 = 2000000
    # ratio = 1.0 == min_cov
    asset = make_asset(
        "cover-exact-min", 2000000.0, 1.0, 1000000.0, 1000000.0,
        True, 10, []
    );

    asset spawn Cover();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    assert str(stamps[0].color) == "green";
}


test "test_cover_justified_amount_is_zero_when_under" {
    # When coverage is insufficient the justified_amount must be exactly 0.0,
    # not negative - Act relies on this to refuse the mint cleanly.
    asset = make_asset(
        "cover-under", 500000.0, 1.0, 1000000.0, 1000000.0,
        True, 10, []
    );

    asset spawn Cover();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    j = float(stamps[0].payload.get("justified_amount", -1.0));
    assert j == 0.0;
}


test "test_cover_payload_contains_coverage_ratio" {
    # The Cover stamp payload must carry both justified_amount and coverage_ratio
    # so that Counsel and the UI can narrate without re-reading the graph.
    asset = make_asset(
        "cover-payload", 2500000.0, 1.0002, 1000000.0, 0.0,
        True, 10, []
    );

    asset spawn Cover();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    payload = stamps[0].payload;
    assert "justified_amount" in payload;
    assert "coverage_ratio"   in payload;
    assert float(payload["coverage_ratio"]) > 1.0;
}
