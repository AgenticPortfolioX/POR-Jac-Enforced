
import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability, Stamp }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy }
import from jac.walkers.auditor { Auditor }
import from jac.lib.utils { now_unix }

test "test_auditor_green_writes_full_checklist" {
    now = now_unix();
    asset = Asset(
        id="test-auditor-green",
        name="AudTest",
        symbol="AUD",
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

    asset spawn Auditor();

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 1;
    s: Stamp = stamps[0];
    assert str(s.color) == "green";

    reasons_str = " | ".join(s.reasons);
    assert "age skew" in reasons_str;
    assert "flat reserve" in reasons_str;
    assert "child attestation - present" in reasons_str;
    assert "liability cover - holds" in reasons_str;
}
