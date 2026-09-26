# jac/tests/paths_tests.jac
# Purpose: Integration tests for three demo paths
# Owner walker/module: shared
# Spec: see PRD §10
# Status: IMPLEMENTED — Prompt 10

import from jac.schemas.nodes { Asset }
import from jac.schemas.edges { StampedBy, MintedAs }
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
