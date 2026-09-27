
import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability, Stamp }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy }
import from jac.walkers.cover { Cover }
import from jac.lib.utils { now_unix }

test "test_cover_green_with_full_coverage" {
    now = now_unix();
    asset = Asset(
        id="test-cover-green",
        name="CoverTest",
        symbol="CVR",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    price = PriceObservation(
        value=1.0,
        timestamp=now - 10,
        source="fixture",
        provenance="test",
        round_id=1
    );
    reserve = ReserveAttestation(
        amount=2500000.0,
        timestamp=now - 10,
        source="fixture",
        provenance="test",
        feed_address="0x0",
        round_id=1,
        answered_in_round=1
    );
    child = ChildClaim(
        asset_id="USDC",
        amount=2500000.0,
        timestamp=now - 10,
        source="fixture",
        present=True,
        provenance="test"
    );
    liab = Liability(
        minted_units=1000000.0,
        vault_shares=0.0,
        demo_position=1000000.0,
        description="test"
    );

    asset +>: HasPrice() :+> price;
    asset +>: HasReserve() :+> reserve;
    reserve +>: DependsOn() :+> child;
    asset +>: HasLiability() :+> liab;

    asset spawn Cover();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    s = stamps[0];
    assert str(s.color) == "green";
    assert float(s.payload.get("justified_amount", -1)) == 500000.0;
}

test "test_cover_red_when_child_missing" {
    now = now_unix();
    asset = Asset(
        id="test-cover-red",
        name="CoverTestRed",
        symbol="CVR2",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    price = PriceObservation(
        value=1.0,
        timestamp=now - 10,
        source="fixture",
        provenance="test",
        round_id=1
    );
    reserve = ReserveAttestation(
        amount=2500000.0,
        timestamp=now - 10,
        source="fixture",
        provenance="test",
        feed_address="0x0",
        round_id=1,
        answered_in_round=1
    );
    child = ChildClaim(
        asset_id="USDC",
        amount=0.0,
        timestamp=now - 10,
        source="fixture",
        present=False,
        provenance="test"
    );
    liab = Liability(
        minted_units=1000000.0,
        vault_shares=0.0,
        demo_position=1000000.0,
        description="test"
    );

    asset +>: HasPrice() :+> price;
    asset +>: HasReserve() :+> reserve;
    reserve +>: DependsOn() :+> child;
    asset +>: HasLiability() :+> liab;

    asset spawn Cover();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    assert str(stamps[0].color) == "red";
}
