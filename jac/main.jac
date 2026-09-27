import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability, Stamp, MintRecord }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy, MintedAs }
import from jac.lib.policy { POLICY }
import from jac.lib.colors { COLOR_GREEN, COLOR_CAUTION, COLOR_RED, COLOR_UNKNOWN, color_rank, min_color }
import from jac.lib.term_colors {
    RESET, BOLD, DIM, SEP,
    FG_GREEN, FG_YELLOW, FG_RED, FG_CYAN, FG_MAGENTA, FG_WHITE, FG_BLUE, FG_GRAY,
    BG_GREEN, BG_BLACK, BG_BLUE
}
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
import from jac.walkers.status { Status }

with entry {
    print("");
    print(BOLD + FG_CYAN + "============================================================" + RESET);
    print(BOLD + FG_CYAN + "   PoRJE  --  Proof of Reserve, Jac Enforced" + RESET);
    print(BOLD + FG_CYAN + "         Chainlink Attestation Engine" + RESET);
    print(BOLD + FG_CYAN + "============================================================" + RESET);
    print("");
    print(BOLD + FG_WHITE + "  Walkers registered:" + RESET);
    print(FG_GREEN  + "    [OK] Ingest            " + DIM + "-- ingest price & reserve data" + RESET);
    print(FG_GREEN  + "    [OK] Freshness         " + DIM + "-- verify data age limits" + RESET);
    print(FG_GREEN  + "    [OK] Cover             " + DIM + "-- calculate overcollateralization" + RESET);
    print(FG_GREEN  + "    [OK] Auditor           " + DIM + "-- final transaction approval gate" + RESET);
    print(FG_GREEN  + "    [OK] Act               " + DIM + "-- EVM mint execution" + RESET);
    print(FG_GREEN  + "    [OK] Counsel           " + DIM + "-- explainability narration" + RESET);
    print(FG_GREEN  + "    [OK] SeedAsset         " + DIM + "-- bootstrap root asset node" + RESET);
    print(FG_GREEN  + "    [OK] DemoOrchestrator  " + DIM + "-- orchestrate full demo path" + RESET);
    print(FG_GREEN  + "    [OK] Status            " + DIM + "-- read-only graph health snapshot" + RESET);
    print("");
    print(SEP);
    print(BOLD + FG_GREEN + "  SERVICE READY  --  awaiting walker calls on :8000" + RESET);
    print(SEP);
    print("");
}
