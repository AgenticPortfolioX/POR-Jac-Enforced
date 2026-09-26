# jac/lib/policy.jac
# Purpose: Global policy knobs and threshold configuration dictionary
# Owner walker/module: shared
# Spec: see PRD §5
# Status: IMPLEMENTED — Prompt 2

glob POLICY: dict = {
    "max_price_age_seconds": 300,
    "max_reserve_age_seconds": 3600,
    "min_coverage_ratio": 1.00,
    "coverage_floor_ratio": 0.95,
    "flat_reserve_epsilon": 0.001,
    "flat_reserve_windows": 3,
    "price_move_epsilon": 0.005,
    "child_max_age_seconds": 3600,
    "colors": {
        "green": "pass",
        "yellow": "caution_blocks_printer",
        "red": "fail",
        "unknown": "missing_fact_halt"
    }
};
