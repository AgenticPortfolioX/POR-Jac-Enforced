import from jac.lib.chainlink_py { latest_round }

def fetch(feed: str) -> dict[str, any] {
    return latest_round(feed);
}
