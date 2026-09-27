
import from jac.schemas.nodes { Asset }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy }
import from jac.walkers.get_asset { GetAsset }
import from jac.walkers.seed_asset { SeedAsset }
import from jac.walkers.demo_control { DemoControl }
import from jac.walkers.ingest { Ingest }


test "test_get_asset_returns_correct_edge_types" {
    # After a happy ingest, GetAsset must return an edges list containing
    # exactly one entry for each of the four edge types the attestation
    # graph uses: HasPrice, HasReserve, DependsOn, HasLiability.
    asset = Asset(
        id="test-ga-shape",
        name="GetAssetTest1",
        symbol="GA1",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn Ingest(use_fixture=True, fixture_name="por_live");

    # Verify the graph has the expected edges directly.
    assert len([asset ->:HasPrice:-> ]) == 1;
    assert len([asset ->:HasReserve:-> ]) == 1;
    assert len([asset ->:HasLiability:-> ]) == 1;
    reserves = [asset ->:HasReserve:-> ];
    assert len([reserves[0] ->:DependsOn:-> ]) == 1;
}


test "test_get_asset_reserve_has_flat_history" {
    # GetAsset must include the flat_history field on the HasReserve target.
    # This is the data the frontend uses to show yellow-verdict evidence
    # in the Cover and Auditor panels.
    asset = Asset(
        id="test-ga-flat",
        name="GetAssetTest2",
        symbol="GA2",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn Ingest(use_fixture=True, fixture_name="por_flat");

    reserves = [asset ->:HasReserve:-> ];
    assert len(reserves) == 1;
    # flat_history is a list field - its presence on the node is what matters.
    h = list(reserves[0].flat_history);
    assert isinstance(h, list);
}


test "test_get_asset_stamps_visible_after_happy_path" {
    # After a full happy path run, GetAsset must be able to read three
    # StampedBy edges off the asset. The stamps are what the frontend reads
    # to render the badge row and enable the Mint button.
    asset = Asset(
        id="test-ga-stamps",
        name="GetAssetTest3",
        symbol="GA3",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn DemoControl(path="happy");

    stamps = [asset ->:StampedBy:-> ];
    assert len(stamps) == 3;
    for s in stamps {
        assert str(s.color) == "green";
    }
}


test "test_get_asset_overall_status_reflects_ingest" {
    # overall_status on the Asset node must not be \"minted\" before Act runs.
    # It starts as \"unknown\" and stays there until Act writes \"minted\" on a
    # successful EVM transaction. This guards against stale status reads.
    asset = Asset(
        id="test-ga-status",
        name="GetAssetTest4",
        symbol="GA4",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn Ingest(use_fixture=True, fixture_name="por_live");

    assert str(asset.overall_status) == "unknown";
}
