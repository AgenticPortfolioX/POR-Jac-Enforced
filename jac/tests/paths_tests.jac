# jac/tests/paths_tests.jac
# Purpose: Integration tests for three demo paths
# Owner walker/module: shared
# Spec: see PRD §10
# Status: IMPLEMENTED — Prompt 10

import from jac.schemas.nodes { Asset }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy, MintedAs }
import from jac.walkers.demo_control { DemoControl }
import from jac.tests.spy_bridge { spy_install, spy_uninstall, spy_reset }

test "test_happy_path_stamps_are_green" {
    asset = Asset(
        id="test-path-happy",
        name="PathTest1",
        symbol="PTH1",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn DemoControl(path="happy");

    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 3;
    for s in stamps {
        assert str(s.color) == "green";
    }
}

test "test_yellow_path_does_not_mint" {
    asset = Asset(
        id="test-path-yellow",
        name="PathTest2",
        symbol="PTH2",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn DemoControl(path="yellow");

    mints = [asset ->:MintedAs:->];
    assert len(mints) == 0;
}

test "test_unknown_path_does_not_mint" {
    asset = Asset(
        id="test-path-unknown",
        name="PathTest3",
        symbol="PTH3",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn DemoControl(path="unknown");

    mints = [asset ->:MintedAs:->];
    assert len(mints) == 0;
}

# Regression guard for the edge-accumulation defect.
#
# Ingest originally cleared its edges with `del [edge here ->:HasPrice:->]` and
# then attached a fresh node. Because Ingest runs as a spawned sibling, that
# deletion was silently lost (each child's commit rewrites the anchor's edge set
# from its own snapshot), so a re-ingest attached a second PriceObservation /
# ReserveAttestation / ChildClaim / Liability while the first stayed attached.
# Freshness reads the OLDEST observation, so N runs on an asset older than
# max_price_age_seconds read a stale timestamp and reported red on an asset that
# had just been refreshed. Three runs must leave exactly one of each.
test "test_re_ingest_does_not_accumulate_edges" {
    asset = Asset(
        id="test-idem-1",
        name="IdemTest",
        symbol="IDEM",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    # Three consecutive happy runs against the SAME asset.
    asset spawn DemoControl(path="happy");
    asset spawn DemoControl(path="happy");
    asset spawn DemoControl(path="happy");

    # Exactly one observation of each type survives — upsert, not append.
    assert len([asset ->:HasPrice:->]) == 1;
    assert len([asset ->:HasReserve:->]) == 1;
    assert len([asset ->:HasLiability:->]) == 1;

    # The child claim hangs off the reserve, not the asset.
    reserves = [asset ->:HasReserve:->];
    assert len([reserves[0] ->:DependsOn:->]) == 1;

    # Stamps dedupe to one per approval walker, and all three are green.
    stamps = [asset ->:StampedBy:->];
    assert len(stamps) == 3;
    for s in stamps {
        assert str(s.color) == "green";
    }
}
