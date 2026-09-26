# jac/lib/policy.jac
# Purpose: Knobs, thresholds, and policy configuration dictionary
# Owner walker/module: shared
# Spec: see PRD §5
# Status: SCAFFOLD — no logic implemented

glob POLICY = {
    "heartbeat_seconds": 86400,
    "max_staleness_seconds": 3600,
    "min_coverage_ratio": 1.0,
    "yellow_threshold_ratio": 1.05,
    "allow_yellow_mint": False,
    "require_child_claims": True,
    "max_mint_per_epoch": 1000000.0,
    "default_color": "unknown"
};
