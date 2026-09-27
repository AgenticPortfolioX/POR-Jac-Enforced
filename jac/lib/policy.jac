#
# `dict[str, any]` is required, not optional. The values here are genuinely
# heterogeneous (int seconds, float ratios, and a nested dict of colour meanings),
# so an unannotated `glob POLICY = {...}` infers a union and every
# `float(POLICY["..."])` call site fails E1053. Jac 0.37 also rejects a bare `dict`
# (E1036) - the explicit `any` is the sanctioned way to say "deliberately dynamic".

glob POLICY: dict[str, any] = {
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
        "caution": "caution_blocks_printer",
        "red": "fail",
        "unknown": "missing_fact_halt"
    }
};
