# jac/walkers/cover.jac
# Purpose: Verify reserve collateral ratio against minted liabilities
# Owner walker/module: Cover
# Spec: see PRD §6.3
# Status: SCAFFOLD — no logic implemented

walker CoverWalker {
    has min_coverage_ratio: float = 1.0;
    has current_coverage: float = 0.0;
    has cover_color: str = "unknown";

    can evaluate_cover with `root() entry {
        # TODO: implement per PRD §6.3
    }
}

# Report shape: {"reserves": float, "liabilities": float, "coverage_ratio": float, "color": str}
