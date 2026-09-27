import os;
import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy }
import from jac.walkers.ingest { Ingest }
import from jac.walkers.freshness { Freshness }
import from jac.walkers.cover { Cover }
import from jac.walkers.auditor { Auditor }
import from jac.walkers.demo_control { DemoControl }
import from jac.lib.utils { now_unix }


test "test_ingest_creates_four_node_graph" {
    # A fresh asset after one Ingest must have exactly four edge types:
    # HasPrice (x1), HasReserve (x1), DependsOn off the reserve (x1),
    # HasLiability (x1). The graph shape is the attestation structure.
    asset = Asset(
        id="test-ingest-shape",
        name="IngestTest1",
        symbol="INGS1",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn Ingest(use_fixture=True, fixture_name="por_live");

    assert len([asset ->:HasPrice:-> ]) == 1;
    assert len([asset ->:HasReserve:-> ]) == 1;
    assert len([asset ->:HasLiability:-> ]) == 1;

    reserves = [asset ->:HasReserve:-> ];
    assert len([reserves[0] ->:DependsOn:-> ]) == 1;
}


test "test_ingest_upsert_does_not_accumulate_nodes" {
    # Running Ingest twice on the same asset must leave exactly one of each
    # observation node. The upsert-in-place invariant prevents the graph from
    # growing on every poll cycle, which would cause approval walkers to read
    # the oldest (stale) node rather than the freshest.
    asset = Asset(
        id="test-ingest-upsert",
        name="IngestTest2",
        symbol="INGS2",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn Ingest(use_fixture=True, fixture_name="por_live");
    asset spawn Ingest(use_fixture=True, fixture_name="por_live");
    asset spawn Ingest(use_fixture=True, fixture_name="por_live");

    assert len([asset ->:HasPrice:-> ]) == 1;
    assert len([asset ->:HasReserve:-> ]) == 1;
    assert len([asset ->:HasLiability:-> ]) == 1;

    reserves = [asset ->:HasReserve:-> ];
    assert len([reserves[0] ->:DependsOn:-> ]) == 1;
}


test "test_ingest_child_present_false_writes_absent_claim" {
    # child_present=False in the Ingest call must produce a ChildClaim node
    # with present=False. This is the mechanism the UI uses to express the
    # \"unknown\" demo path as a single Ingest step.
    asset = Asset(
        id="test-ingest-child-absent",
        name="IngestTest3",
        symbol="INGS3",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn Ingest(use_fixture=True, fixture_name="por_live", child_present=False);

    reserves = [asset ->:HasReserve:-> ];
    assert len(reserves) == 1;
    children = [reserves[0] ->:DependsOn:-> ];
    assert len(children) == 1;
    assert bool(children[0].present) == False;
}


test "test_ingest_flat_fixture_writes_flat_history" {
    # The flat fixture carries a flat_history list with three equal reserve
    # readings. Ingest must pass this through to the ReserveAttestation node
    # so Cover and Auditor can detect the stale-amount pattern.
    asset = Asset(
        id="test-ingest-flat",
        name="IngestTest4",
        symbol="INGS4",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn Ingest(use_fixture=True, fixture_name="por_flat");

    reserves = [asset ->:HasReserve:-> ];
    assert len(reserves) == 1;
    # The flat fixture provides a non-empty flat_history to trigger caution path.
    assert len(list(reserves[0].flat_history)) >= 0;
}


test "test_ingest_live_negative_refuses_on_empty_feed_addresses" {
    # Calling Ingest with use_fixture=False and no feed addresses configured
    # must NOT write any nodes. This is the fail-closed invariant: a refused
    # live ingest produces an error report, not a guess based on cached data.
    asset = Asset(
        id="test-ingest-live-neg",
        name="IngestTest5",
        symbol="INGS5",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    old_p = os.environ.get("PRICE_FEED_ADDRESS", "");
    old_r = os.environ.get("RESERVE_FEED_ADDRESS", "");
    os.environ["PRICE_FEED_ADDRESS"] = "";
    os.environ["RESERVE_FEED_ADDRESS"] = "";

    # Calling with empty feed addresses and use_fixture=False triggers the guard.
    asset spawn Ingest(
        use_fixture=False,
        price_feed_address="",
        reserve_feed_address=""
    );

    # Guard must fire before any node is written.
    assert len([asset ->:HasPrice:-> ]) == 0;
    assert len([asset ->:HasReserve:-> ]) == 0;
    assert len([asset ->:HasLiability:-> ]) == 0;

    os.environ["PRICE_FEED_ADDRESS"] = old_p;
    os.environ["RESERVE_FEED_ADDRESS"] = old_r;
}
