
import from jac.schemas.nodes { Asset }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy, MintedAs }
import from jac.walkers.demo_control { DemoControl }
import from jac.walkers.ingest { Ingest }
import from jac.walkers.freshness { Freshness }
import from jac.walkers.cover { Cover }
import from jac.walkers.auditor { Auditor }
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

test "test_caution_path_does_not_mint" {
    asset = Asset(
        id="test-path-caution",
        name="PathTest2",
        symbol="PTH2",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn DemoControl(path="caution");

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

    # Exactly one observation of each type survives - upsert, not append.
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

# The UI walks a path one walker at a time - Ingest, then Freshness, Cover and
# Auditor as separate requests - so the traversal is visible on screen instead
# of happening inside a single DemoControl frame. That only works if the
# stepwise walk produces the same verdicts as the one-call path; if the two
# ever diverge, the demo would show a result the CLI cannot reproduce.
test "test_stepwise_walk_matches_demo_control" {
    stepwise = Asset(
        id="test-stepwise-1",
        name="StepwiseTest",
        symbol="STEP",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> stepwise;

    stepwise spawn Ingest(use_fixture=True, fixture_name="por_live");
    stepwise spawn Freshness();
    stepwise spawn Cover();
    stepwise spawn Auditor();

    onestep = Asset(
        id="test-stepwise-2",
        name="StepwiseTest2",
        symbol="STEP2",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> onestep;

    onestep spawn DemoControl(path="happy");

    for name in ["Freshness", "Cover", "Auditor"] {
        a = [s for s in [stepwise ->:StampedBy:->] if str(s.walker_name) == name];
        b = [s for s in [onestep ->:StampedBy:->] if str(s.walker_name) == name];
        assert len(a) == 1;
        assert len(b) == 1;
        assert str(a[0].color) == str(b[0].color);
    }

    # Same shape of graph, not just the same colours.
    assert len([stepwise ->:HasPrice:->]) == len([onestep ->:HasPrice:->]);
    assert len([stepwise ->:HasReserve:->]) == len([onestep ->:HasReserve:->]);
    assert len([stepwise ->:HasLiability:->]) == len([onestep ->:HasLiability:->]);
}

# Ingest can declare the child absent in one call. This is what lets the UI
# express the "unknown" path as a single visible Ingest step rather than a
# separate traversal that reaches in and flips the child afterwards.
test "test_ingest_child_present_false_marks_the_child_absent" {
    asset = Asset(
        id="test-childflag-1",
        name="ChildFlagTest",
        symbol="CFLAG",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn Ingest(
        use_fixture=True,
        fixture_name="por_live",
        child_present=False
    );

    reserves = [asset ->:HasReserve:->];
    assert len(reserves) == 1;
    children = [reserves[0] ->:DependsOn:->];
    assert len(children) == 1;
    assert bool(children[0].present) == False;

    # And the walkers that read the child must see the absence.
    asset spawn Freshness();
    asset spawn Cover();
    cover = [s for s in [asset ->:StampedBy:->] if str(s.walker_name) == "Cover"][0];
    assert str(cover.color) == "red";
}
