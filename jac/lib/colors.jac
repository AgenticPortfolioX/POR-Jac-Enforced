# jac/lib/colors.jac
# Purpose: Color constants and ranking helpers for stamp evaluation
# Owner walker/module: shared
# Spec: see PRD §4, §5
# Status: IMPLEMENTED — Prompt 2

glob COLOR_GREEN = "green";
glob COLOR_YELLOW = "yellow";
glob COLOR_RED = "red";
glob COLOR_UNKNOWN = "unknown";

def color_rank(c: str) -> int {
    if c == COLOR_GREEN {
        return 0;
    }
    if c == COLOR_YELLOW {
        return 1;
    }
    if c == COLOR_RED {
        return 2;
    }
    return 3;
}

def min_color(a: str, b: str) -> str {
    if color_rank(a) >= color_rank(b) {
        return a;
    }
    return b;
}
