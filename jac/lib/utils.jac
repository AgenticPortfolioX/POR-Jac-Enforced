# jac/lib/utils.jac
# Purpose: General mathematical and timestamp utility functions
# Owner walker/module: shared
# Spec: see PRD §3
# Status: SCAFFOLD — no logic implemented

def now() -> int {
    # TODO: unix seconds
    return 0;
}

def abs(a: float, b: float) -> float {
    # TODO
    if a >= b {
        return a - b;
    }
    return b - a;
}
