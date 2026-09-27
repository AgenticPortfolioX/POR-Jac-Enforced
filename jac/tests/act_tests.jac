
import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, Stamp, Liability }
import from jac.schemas.edges { HasPrice, HasReserve, HasLiability, StampedBy, MintedAs }
import from jac.walkers.act { Act }
import from jac.lib.utils { now_unix }
import from jac.tests.spy_bridge { spy_install, spy_uninstall, spy_reset, spy_mint_call_count, spy_last_mint_args }

def make_green_asset(asset_id: str, justified: float) -> Asset {
    now = now_unix();
    asset = Asset(
        id=asset_id,
        name="ActTest",
        symbol="ACT",
        chain="test",
        token_address="0xTOKEN",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    price = PriceObservation(value=1.0, timestamp=now-10, source="fixture", provenance="test", round_id=1);
    reserve = ReserveAttestation(amount=1000000.0, timestamp=now-10, source="fixture", provenance="test", feed_address="0x0", round_id=1, answered_in_round=1);
    liab = Liability(minted_units=0.0, vault_shares=0.0, demo_position=0.0, description="test");

    asset +>: HasPrice() :+> price;
    asset +>: HasReserve() :+> reserve;
    asset +>: HasLiability() :+> liab;

    f_stamp = Stamp(walker_name="Freshness", color="green", reasons=["ok"], timestamp=now, payload={});
    c_stamp = Stamp(walker_name="Cover", color="green", reasons=["ok"], timestamp=now, payload={"justified_amount": justified, "coverage_ratio": 1.25});
    a_stamp = Stamp(walker_name="Auditor", color="green", reasons=["ok"], timestamp=now, payload={});

    asset +>: StampedBy() :+> f_stamp;
    asset +>: StampedBy() :+> c_stamp;
    asset +>: StampedBy() :+> a_stamp;

    return asset;
}

test "test_act_refuses_without_three_greens" {
    now = now_unix();
    asset = Asset(
        id="test-act-no-stamps",
        name="ActTest1",
        symbol="ACT1",
        chain="test",
        token_address="0xTOKEN",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    # Only two stamps
    f_stamp = Stamp(walker_name="Freshness", color="green", reasons=["ok"], timestamp=now, payload={});
    c_stamp = Stamp(walker_name="Cover", color="green", reasons=["ok"], timestamp=now, payload={"justified_amount": 100.0, "coverage_ratio": 1.0});
    asset +>: StampedBy() :+> f_stamp;
    asset +>: StampedBy() :+> c_stamp;

    spy_install();
    asset spawn Act(requested_amount=100.0, recipient="0x1234", token_address="0xTOKEN", attestation_address="0xATT");
    assert spy_mint_call_count() == 0;
    assert len([asset ->:MintedAs:->]) == 0;
    spy_uninstall();
    spy_reset();
}

test "test_act_refuses_with_yellow_cover" {
    now = now_unix();
    asset = Asset(
        id="test-act-yellow",
        name="ActTest2",
        symbol="ACT2",
        chain="test",
        token_address="0xTOKEN",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    price = PriceObservation(value=1.0, timestamp=now-10, source="fixture", provenance="test", round_id=1);
    reserve = ReserveAttestation(amount=1000000.0, timestamp=now-10, source="fixture", provenance="test", feed_address="0x0", round_id=1, answered_in_round=1);
    asset +>: HasPrice() :+> price;
    asset +>: HasReserve() :+> reserve;

    f_stamp = Stamp(walker_name="Freshness", color="green", reasons=["ok"], timestamp=now, payload={});
    c_stamp = Stamp(walker_name="Cover", color="yellow", reasons=["flat"], timestamp=now, payload={"justified_amount": 100.0, "coverage_ratio": 1.0});
    a_stamp = Stamp(walker_name="Auditor", color="green", reasons=["ok"], timestamp=now, payload={});
    asset +>: StampedBy() :+> f_stamp;
    asset +>: StampedBy() :+> c_stamp;
    asset +>: StampedBy() :+> a_stamp;

    spy_install();
    asset spawn Act(requested_amount=100.0, recipient="0x1234", token_address="0xTOKEN", attestation_address="0xATT");
    assert spy_mint_call_count() == 0;
    spy_uninstall();
    spy_reset();
}

test "test_act_mints_only_min_of_requested_and_justified" {
    asset = make_green_asset("test-act-min", 500000.0);
    spy_install();
    asset spawn Act(requested_amount=900000.0, recipient="0x1234", token_address="0xTOKEN", attestation_address="0xATT");
    assert spy_mint_call_count() == 1;
    args = spy_last_mint_args();
    assert float(args[2]) == 500000.0;
    spy_uninstall();
    spy_reset();
}

test "test_act_does_not_call_evm_when_justified_is_zero" {
    asset = make_green_asset("test-act-zero", 0.0);
    spy_install();
    asset spawn Act(requested_amount=100.0, recipient="0x1234", token_address="0xTOKEN", attestation_address="0xATT");
    assert spy_mint_call_count() == 0;
    spy_uninstall();
    spy_reset();
}

test "test_act_writes_mint_record_on_success" {
    # The positive half of Invariant 6: a successful mint must leave a durable
    # MintRecord node carrying the minted amount, the coverage that permitted it,
    # and the stamp summary that authorized it.
    asset = make_green_asset("test-act-record", 500000.0);
    spy_install();
    asset spawn Act(requested_amount=900000.0, recipient="0x1234", token_address="0xTOKEN", attestation_address="0xATT");
    assert spy_mint_call_count() == 1;

    records = [asset ->:MintedAs:->];
    assert len(records) == 1;
    assert float(records[0].minted_amount) == 500000.0;
    assert float(records[0].coverage_used) == 500000.0;
    assert float(records[0].nft_token_id) == 999.0;
    assert str(records[0].stamp_summary["Freshness"]) == "green";
    assert str(records[0].stamp_summary["Cover"]) == "green";
    assert str(records[0].stamp_summary["Auditor"]) == "green";

    spy_uninstall();
    spy_reset();
}

test "test_act_passes_only_primitives_to_evm" {
    asset = make_green_asset("test-act-primitives", 500000.0);
    spy_install();
    asset spawn Act(requested_amount=100.0, recipient="0x1234", token_address="0xTOKEN", attestation_address="0xATT");
    assert spy_mint_call_count() == 1;
    args = spy_last_mint_args();
    for a in args {
        assert isinstance(a, (str, int, float, bool, type(None)));
    }
    spy_uninstall();
    spy_reset();
}
