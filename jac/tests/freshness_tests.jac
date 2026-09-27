
import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, Stamp }
import from jac.schemas.edges { HasPrice, HasReserve, StampedBy }
import from jac.walkers.freshness { Freshness }
import from jac.lib.utils { now_unix }

test "test_freshness_green" {
    now = now_unix();
    asset = Asset(
        id="test-asset-fresh",
        name="Test",
        symbol="TST",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    price = PriceObservation(
        value=1.0002,
        timestamp=now - 12,
        source="fixture",
        provenance="test",
        round_id=1
    );
    reserve = ReserveAttestation(
        amount=1250000.0,
        timestamp=now - 30,
        source="fixture",
        provenance="test",
        feed_address="0x0",
        round_id=1,
        answered_in_round=1
    );

    asset +>: HasPrice() :+> price;
    asset +>: HasReserve() :+> reserve;

    asset spawn Freshness();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    assert str(stamps[0].walker_name) == "Freshness";
    assert str(stamps[0].color) == "green";
}

test "test_freshness_unknown_when_price_missing" {
    asset = Asset(
        id="test-asset-no-price",
        name="Test2",
        symbol="TST2",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn Freshness();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    assert str(stamps[0].color) == "unknown";
}
