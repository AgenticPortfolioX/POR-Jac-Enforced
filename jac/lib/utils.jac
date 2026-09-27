import time;
import os;

glob PORJE_TRACE: bool = os.environ.get("PORJE_TRACE", "0") == "1";

def now_unix() -> int {
    return int(time.time());
}

def abs_diff(a: float, b: float) -> float {
    if a > b {
        return a - b;
    }
    return b - a;
}

def pct_change(old: float, new_val: float) -> float {
    if old == 0.0 {
        return 0.0;
    }
    return (new_val - old) / old;
}
