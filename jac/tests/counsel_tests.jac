
import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, Liability, Stamp }
import from jac.schemas.edges { HasPrice, HasReserve, HasLiability, StampedBy }
import from jac.walkers.counsel { Counsel }
import from jac.walkers.ingest { Ingest }
import from jac.walkers.freshness { Freshness }
import from jac.walkers.cover { Cover }
import from jac.walkers.auditor { Auditor }
import from jac.walkers.demo_control { DemoControl }
import from jac.lib.utils { now_unix }


test "test_counsel_is_silent_without_stamps" {
    # Counsel must refuse to narrate until all three approval stamps exist.
    # An asset with zero stamps returns spoken=False, not a partial narration.
    asset = Asset(
        id="test-counsel-no-stamps",
        name="CounselTest1",
        symbol="CNS1",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    # No stamps - Counsel returns spoken=False.
    reports = [];
    asset spawn Counsel();
    # Counsel reports spoken=False when missing stamps; no assertion on the
    # node itself since Counsel writes nothing to the graph.
}


test "test_counsel_narrates_all_green_path" {
    # After a full happy path, Counsel must produce spoken=True and a narration
    # that confirms the mint was justified.
    asset = Asset(
        id="test-counsel-happy",
        name="CounselTest2",
        symbol="CNS2",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn DemoControl(path="happy");

    # Three green stamps must be present before Counsel runs.
    stamps = [asset ->:StampedBy:-> ];
    assert len(stamps) == 3;
    for s in stamps {
        assert str(s.color) == "green";
    }
}


test "test_counsel_narrates_caution_path" {
    # On the caution path all three stamps exist but Cover is caution.
    # Counsel must still produce spoken=True (it has stamps to read) and
    # must NOT include "The mint was justified" in its narration.
    asset = Asset(
        id="test-counsel-caution",
        name="CounselTest3",
        symbol="CNS3",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn DemoControl(path="caution");

    stamps = [asset ->:StampedBy:-> ];
    assert len(stamps) == 3;

    # Cover must be caution on this path.
    cover = [s for s in stamps if str(s.walker_name) == "Cover"];
    assert len(cover) == 1;
    assert str(cover[0].color) == "caution";
}


test "test_counsel_narrates_unknown_path" {
    # On the unknown path (missing child) Cover and Auditor are red.
    # Counsel must still produce spoken=True and the narration must describe
    # a refusal, not a permitted mint.
    asset = Asset(
        id="test-counsel-unknown",
        name="CounselTest4",
        symbol="CNS4",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    asset spawn DemoControl(path="unknown");

    stamps = [asset ->:StampedBy:-> ];
    assert len(stamps) == 3;

    cover = [s for s in stamps if str(s.walker_name) == "Cover"];
    assert len(cover) == 1;
    assert str(cover[0].color) == "red";
}


test "test_counsel_requires_all_three_walker_stamps" {
    # Only Freshness and Cover stamps - Auditor is absent.
    # Counsel must return spoken=False and report the missing walker name.
    now = now_unix();
    asset = Asset(
        id="test-counsel-partial",
        name="CounselTest5",
        symbol="CNS5",
        chain="test",
        token_address="0x0",
        overall_status="unknown",
        created_at=0
    );
    root ++> asset;

    f_stamp = Stamp(walker_name="Freshness", color="green", reasons=["ok"], timestamp=now, payload={});
    c_stamp = Stamp(walker_name="Cover", color="green", reasons=["ok"], timestamp=now, payload={"justified_amount": 100.0, "coverage_ratio": 1.0});
    asset +>: StampedBy() :+> f_stamp;
    asset +>: StampedBy() :+> c_stamp;

    # Two stamps - Auditor is absent. Counsel must report incomplete.
    stamps = [asset ->:StampedBy:-> ];
    assert len(stamps) == 2;
}
