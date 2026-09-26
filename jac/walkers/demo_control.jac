# jac/walkers/demo_control.jac
# Purpose: Seed graph for one of three demo paths and run all approval walkers
# Owner walker/module: DemoControl
# Spec: see PRD §9
# Status: IMPLEMENTED — Prompt 8

import from jac.schemas.nodes { Asset }
import from jac.schemas.edges { HasReserve, DependsOn, StampedBy }
import from jac.walkers.ingest { Ingest }
import from jac.walkers.freshness { Freshness }
import from jac.walkers.cover { Cover }
import from jac.walkers.auditor { Auditor }

walker:pub DemoControl {
    has path: str = "happy";

    can run with Asset entry {
        # Reset the asset's stamps BEFORE seeding fixtures, so one DemoControl run
        # leaves exactly one Freshness + one Cover + one Auditor stamp.
        #
        # This deletion must happen here, in the anchor's own ability frame, and
        # before any sibling spawns. Jac commits a node's edge set from the walker
        # that touched it: once a spawned sibling attaches an edge to this anchor,
        # the anchor's in-memory edge list is rebuilt from the touched edges alone
        # and the lazily-persisted StampedBy edges stop being visible to siblings
        # spawned afterwards. The approval walkers would then each fail to find
        # their own prior stamp and append a new one, so stamps would accumulate
        # (3, 6, 9, ...) on every run. Deleting from the parent's own frame, while
        # the persisted edges are still visible, avoids that entirely.
        # See jac/walkers/freshness.jac for the matching upsert rationale.
        for prior_stamp in [here ->:StampedBy:->] {
            here del --> prior_stamp;
        }

        if self.path == "happy" {
            here spawn Ingest(use_fixture=True, fixture_name="por_live");
        } elif self.path == "yellow" {
            here spawn Ingest(use_fixture=True, fixture_name="por_flat");
        } elif self.path == "unknown" {
            here spawn Ingest(use_fixture=True, fixture_name="por_live");
            # Corrupt the child claim to simulate missing backing
            reserves = [here ->:HasReserve:->];
            if len(reserves) > 0 {
                for child in [reserves[0] ->:DependsOn:->] {
                    child.present = False;
                }
            }
        } else {
            report {"error": "unknown path " + self.path};
            return;
        }

        here spawn Freshness();
        here spawn Cover();
        here spawn Auditor();

        report {"path": self.path, "status": "walkers_run"};
    }
}
