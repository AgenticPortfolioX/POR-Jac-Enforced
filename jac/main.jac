# jac/main.jac
# Purpose: Main entrypoint and walker registry for PoRJE
# Owner walker/module: shared
# Spec: see PRD §3.3, §9
# Status: IMPLEMENTED — Prompts 2-9

import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability, Stamp, MintRecord }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy, MintedAs }
import from jac.lib.policy { POLICY }
import from jac.lib.colors { COLOR_GREEN, COLOR_YELLOW, COLOR_RED, COLOR_UNKNOWN, color_rank, min_color }
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

with entry {
    print("PoRJE root scaffold booted");
}
