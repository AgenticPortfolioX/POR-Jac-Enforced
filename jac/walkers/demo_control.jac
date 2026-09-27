import from jac.schemas.nodes { Asset }
import from jac.walkers.ingest { Ingest }
import from jac.walkers.freshness { Freshness }
import from jac.walkers.cover { Cover }
import from jac.walkers.auditor { Auditor }

walker:pub DemoControl {
    has path: str = "happy";

    can run with Asset entry {
        # Stamps are upserted in place by each approval walker, replacing prior stamps
        # and preserving graph invariants across concurrent sibling frames.
        if self.path == "happy" {
            here spawn Ingest(use_fixture=True, fixture_name="por_live");
        } elif self.path == "yellow" {
            here spawn Ingest(use_fixture=True, fixture_name="por_flat");
        } elif self.path == "unknown" {
            here spawn Ingest(use_fixture=True, fixture_name="por_live", child_present=False);
        } elif self.path == "live" {
            here spawn Ingest(use_fixture=False);
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
