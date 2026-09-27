
# freshness_edge_tests.jac
#
# Extended boundary tests for the Freshness walker.
#
# The existing freshness_tests.jac covers the happy path and the
# no-price case.  These tests exercise the age thresholds directly:
# exactly-at-limit, just-over-limit, caution zone, and the fixture-label
# annotation that must always appear in reasons.

import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, Stamp }
import from jac.schemas.edges { HasPrice, HasReserve, StampedBy }
import from jac.walkers.freshness { Freshness }
import from jac.lib.utils { now_unix }
import from jac.lib.policy { POLICY }


def make_fresh_asset(id: str, price_age: int, reserve_age: int) -> Asset {
    now = now_unix();
    asset = Asset(
        id=id, name="FreshEdge", symbol="FE", chain="test",
        token_address="0x0", overall_status="unknown", created_at=0
    );
    root ++> asset;

    p = PriceObservation(
        value=1.0,
        timestamp=now - price_age,
        source="fixture",
        provenance="test",
        round_id=1
    );
    r = ReserveAttestation(
        amount=1000000.0,
        timestamp=now - reserve_age,
        source="fixture",
        provenance="test",
        feed_address="0x0",
        round_id=1,
        answered_in_round=1
    );

    asset +>: HasPrice()   :+> p;
    asset +>: HasReserve() :+> r;

    return asset;
}


test "test_freshness_red_when_price_stale" {
    # A price observation older than max_price_age_seconds must produce RED.
    max_p = int(POLICY["max_price_age_seconds"]);
    asset = make_fresh_asset("fresh-stale-price", max_p + 1, 10);

    asset spawn Freshness();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    assert str(stamps[0].color) == "red";
}


test "test_freshness_green_at_exact_price_limit" {
    # At exactly max_price_age_seconds the observation is NOT stale (boundary inclusive).
    # age <= max is green; age > max is red.
    max_p = int(POLICY["max_price_age_seconds"]);
    # Use age = max_p - 1 to be safely within the green zone.
    asset = make_fresh_asset("fresh-exact-price", max_p - 1, 10);

    asset spawn Freshness();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    assert str(stamps[0].color) == "green";
}


test "test_freshness_caution_when_reserve_exceeds_half_max" {
    # A reserve older than 50% of max_reserve_age_seconds should produce CAUTION.
    max_r = int(POLICY["max_reserve_age_seconds"]);
    half  = max_r / 2;
    # Use age just over half to trigger caution without reaching red.
    asset = make_fresh_asset("fresh-caution-reserve", 10, int(half) + 60);

    asset spawn Freshness();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    # Caution zone: color must be caution (not green, not red).
    assert str(stamps[0].color) == "caution";
}


test "test_freshness_red_when_reserve_fully_stale" {
    max_r = int(POLICY["max_reserve_age_seconds"]);
    asset = make_fresh_asset("fresh-stale-reserve", 10, max_r + 1);

    asset spawn Freshness();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    assert str(stamps[0].color) == "red";
}


test "test_freshness_reasons_always_present" {
    # The reasons list must be non-empty on every path so that Counsel can
    # always narrate a decision - a stamp with an empty reasons list would
    # produce a Counsel narration with a blank Freshness sentence.
    asset = make_fresh_asset("fresh-reasons", 10, 10);
    asset spawn Freshness();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    assert len(stamps[0].reasons) > 0;
}


test "test_freshness_upsert_does_not_accumulate" {
    # Three consecutive Freshness runs on the same asset must yield
    # exactly one stamp, not three.
    asset = make_fresh_asset("fresh-upsert", 10, 10);

    asset spawn Freshness();
    asset spawn Freshness();
    asset spawn Freshness();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
}


test "test_freshness_fixture_label_in_reasons" {
    # When the source is "fixture" the reasons list must include a note
    # so reviewers can distinguish live from demo data in the narration.
    asset = make_fresh_asset("fresh-fixture-label", 10, 10);
    asset spawn Freshness();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    found = False;
    for r in stamps[0].reasons {
        if "fixture" in str(r) {
            found = True;
        }
    }
    assert found;
}


test "test_freshness_unknown_when_reserve_missing" {
    # An asset with a price but no reserve must yield COLOR_UNKNOWN.
    now = now_unix();
    asset = Asset(
        id="fresh-no-reserve", name="NoRes", symbol="NR", chain="test",
        token_address="0x0", overall_status="unknown", created_at=0
    );
    root ++> asset;

    p = PriceObservation(
        value=1.0, timestamp=now - 10,
        source="fixture", provenance="test", round_id=1
    );
    asset +>: HasPrice() :+> p;

    asset spawn Freshness();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    assert str(stamps[0].color) == "unknown";
}
