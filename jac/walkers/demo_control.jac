# jac/walkers/demo_control.jac
# Purpose: Orchestrate demo paths (happy, yellow, unknown) and graph resets
# Owner walker/module: shared
# Spec: see PRD §6.7, §11
# Status: SCAFFOLD — no logic implemented

walker DemoControlWalker {
    has path: str = "happy";

    can execute_path with `root() entry {
        # TODO: implement per PRD §6.7
    }
}

# Report shape: {"path": str, "status": str, "stamp_summary": dict}
