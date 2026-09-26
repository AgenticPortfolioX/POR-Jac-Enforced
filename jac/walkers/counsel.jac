# jac/walkers/counsel.jac
# Purpose: Policy advice, explanation of failures, and remediation guide
# Owner walker/module: Counsel
# Spec: see PRD §6.6
# Status: SCAFFOLD — no logic implemented

walker CounselWalker {
    has target_stamp_id: str = "";

    can advise with `root() entry {
        # TODO: implement per PRD §6.6
    }
}

# Report shape: {"color": str, "findings": list, "recommendations": list}
