# jac/walkers/demo_control.jac
# Purpose: Seed graph for one of three demo paths and run all approval walkers
# Owner walker/module: DemoControl
# Spec: see PRD §9
# Status: IMPLEMENTED — Prompt 8

import from jac.schemas.edges { HasReserve, DependsOn }
import from jac.walkers.ingest { Ingest }
import from jac.walkers.freshness { Freshness }
import from jac.walkers.cover { Cover }
import from jac.walkers.auditor { Auditor }

walker:pub DemoControl {
    has path: str = "happy";

    can run with Asset entry {
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
