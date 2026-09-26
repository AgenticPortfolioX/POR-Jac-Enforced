# jac/lib/fixtures.jac
# Purpose: Load JSON fixture files for reproducible simulation paths
# Owner walker/module: shared
# Spec: see PRD §7.4
# Status: SCAFFOLD — no logic implemented

def load(name: str) -> dict {
    # TODO: read fixtures/<name>.json, enforce label == "fixture"
    print(f"Loading fixture {name}");
    return {};
}
