import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability, Stamp, MintRecord }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy, MintedAs }
import from jac.lib.policy { POLICY }
import from jac.lib.colors { COLOR_GREEN, COLOR_CAUTION, COLOR_RED, COLOR_UNKNOWN, color_rank, min_color }
import from jac.walkers.ingest { Ingest }
import from jac.walkers.freshness { Freshness }
import from jac.walkers.cover { Cover }
import from jac.walkers.auditor { Auditor }
import from jac.walkers.act { Act }
import from jac.walkers.counsel { Counsel }
import from jac.walkers.demo_control { DemoControl }
import from jac.walkers.get_asset { GetAsset }
import from jac.walkers.get_stamps { GetStamps }
import from jac.walkers.seed_asset { SeedAsset }
import from jac.walkers.health_check { HealthCheck }
import from jac.walkers.demo_orchestrator { DemoOrchestrator }

with entry {
    print("PoRJE service initialized");
}
