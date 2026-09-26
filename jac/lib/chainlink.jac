# jac/lib/chainlink.jac
# Purpose: Jac interface to Chainlink Python data fetcher
# Owner walker/module: shared
# Spec: see PRD §7.2
# Status: SCAFFOLD — no logic implemented

import from chainlink_py { latest_round }

def fetch(feed: str) -> dict {
    # TODO: delegate to latest_round
    return latest_round(feed);
}
