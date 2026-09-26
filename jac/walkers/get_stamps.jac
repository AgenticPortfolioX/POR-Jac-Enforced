# jac/walkers/get_stamps.jac
# Purpose: Read-only walker returning all stamps on an Asset
# Owner walker/module: shared
# Spec: see PRD §9
# Status: IMPLEMENTED — Prompt 9

import from jac.schemas.nodes { Asset }
import from jac.schemas.edges { StampedBy }

walker:pub GetStamps {
    can run with Asset entry {
        stamps: list[dict[str, any]] = [];
        for s in [here ->:StampedBy:->] {
            stamps.append({
                "walker_name": str(s.walker_name),
                "color": str(s.color),
                "reasons": list(s.reasons),
                "timestamp": int(s.timestamp),
                "payload": dict(s.payload)
            });
        }
        report {"stamps": stamps};
    }
}
