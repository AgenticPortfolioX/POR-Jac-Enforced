# jac/walkers/demo_control.jac
# Purpose: Seed graph for one of three demo paths and run all approval walkers
# Owner walker/module: DemoControl
# Spec: see PRD §9
# Status: IMPLEMENTED — Prompt 8

import from jac.schemas.nodes { Asset }
import from jac.schemas.edges { HasReserve, DependsOn }
import from jac.walkers.ingest { Ingest }
import from jac.walkers.freshness { Freshness }
import from jac.walkers.cover { Cover }
import from jac.walkers.auditor { Auditor }

walker:pub DemoControl {
    has path: str = "happy";

    can run with Asset entry {
        # No stamp reset here, and none is possible from this frame.
        #
        # Stamps are upserted in place by each approval walker, so a re-run replaces
        # the previous stamp for that walker rather than appending a second one. That
        # upsert — not any deletion — is what holds the one-stamp-per-walker
        # invariant.
        #
        # A `del [edge here ->:StampedBy:->]` here would read as a reset but is
        # silently lost: each spawned child's commit re-writes this anchor's edge set
        # from its own snapshot, restoring edges a sibling had just deleted. The same
        # semantics are why Ingest upserts its observations instead of clearing them.
        # See docs/architecture.md, "Spawned-sibling commit semantics".

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
