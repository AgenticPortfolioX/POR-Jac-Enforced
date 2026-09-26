# jac/lib/chainlink.jac
# Purpose: Jac wrapper around Chainlink Python bridge
# Owner walker/module: shared
# Spec: see PRD §6.3
# Status: IMPLEMENTED — Prompt 3

import from jac.lib.chainlink_py { latest_round }

def fetch(feed: str) -> dict {
    return latest_round(feed);
}
