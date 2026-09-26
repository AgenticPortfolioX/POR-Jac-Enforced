# jac/lib/colors.jac
# Purpose: Health state color definitions and ranking helper
# Owner walker/module: shared
# Spec: see PRD §4, §5
# Status: SCAFFOLD — no logic implemented

glob COLORS = {"green", "yellow", "red", "unknown"};

def rank(c: str) -> int {
    # TODO: green=0, yellow=1, red=2, unknown=3
    if c == "green" {
        return 0;
    } elif c == "yellow" {
        return 1;
    } elif c == "red" {
        return 2;
    }
    return 3;
}
