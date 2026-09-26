# main.jac
# Purpose: Root application entrypoint for Jachammer / Jac Cloud / Native Jac execution
# Owner walker/module: shared
# Spec: see PRD §3.3, §9
# Status: SCAFFOLD — entrypoint registration

import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability, Stamp, MintRecord }
import from jac.schemas.edges { HasObservation, HasAttestation, HasChildClaim, EvaluatesLiability, ProducesStamp, ResultsInMint }
import from jac.walkers.ingest { IngestWalker }
import from jac.walkers.freshness { FreshnessWalker }
import from jac.walkers.cover { CoverWalker }
import from jac.walkers.auditor { AuditorWalker }
import from jac.walkers.act { ActWalker }
import from jac.walkers.counsel { CounselWalker }
import from jac.walkers.demo_control { DemoControlWalker }

with entry {
    print("PoRJE root scaffold booted");
}
