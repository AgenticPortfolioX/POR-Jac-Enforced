
# metrics.jac
#
# Pure helper functions for the PoRJE coverage and age calculations.
# These have NO side-effects, write NO graph nodes, and are imported by
# walkers that need the same math in more than one place.  Centralising
# them here means a policy change (e.g. a new coverage floor) only needs
# to be understood in one context rather than across three separate walker
# bodies.
#
# All inputs and outputs are plain scalars.  The functions never inspect
# the graph - they are called after the walker has already read its edges.

import from jac.lib.utils { abs_diff }


# ---------------------------------------------------------------------------
# Age helpers
# ---------------------------------------------------------------------------

def is_stale(observation_ts: int, now_ts: int, max_age_seconds: int) -> bool {
    """Return True when the observation is older than the policy limit."""
    age = abs_diff(float(now_ts), float(observation_ts));
    return age > float(max_age_seconds);
}


def age_seconds(observation_ts: int, now_ts: int) -> float {
    """Unsigned age in seconds between an observation timestamp and now."""
    return abs_diff(float(now_ts), float(observation_ts));
}


def exceeds_half_limit(observation_ts: int, now_ts: int, max_age_seconds: int) -> bool {
    """True when the observation is older than 50% of the policy max age.

    Used by Freshness to emit COLOR_CAUTION before a feed becomes fully stale.
    The 50% threshold is deliberately conservative: a reserve feed that
    updates every hour should be flagged at 30 minutes, not at 59.
    """
    age = abs_diff(float(now_ts), float(observation_ts));
    return age > float(max_age_seconds) * 0.5;
}


def age_skew_seconds(ts_a: int, ts_b: int) -> float {
    """Unsigned difference between two observation timestamps.

    Used by Auditor to detect when the price and reserve feeds are
    published at very different times - a sign that one of the feeds
    may have been sourced from a different round than the other.
    """
    return abs_diff(float(ts_a), float(ts_b));
}


# ---------------------------------------------------------------------------
# Reserve helpers
# ---------------------------------------------------------------------------

def is_flat_reserve(history: list, epsilon: float, min_windows: int) -> bool {
    """Return True when a reserve feed has not moved meaningfully.

    A reserve that publishes the same amount every round while the price
    feed changes is a known manipulation vector: it presents a
    superficially healthy coverage ratio while the real backing may have
    been drained.  The Auditor and Cover walkers both check for this.

    Parameters
    ----------
    history:     list of historical reserve amounts, most-recent first.
    epsilon:     minimum fractional change considered non-flat (e.g. 0.001).
    min_windows: minimum number of history entries required before the
                 check is applied (avoids false positives on short histories).
    """
    if len(history) < min_windows {
        return False;
    }
    first_val = float(history[0]);
    last_val  = float(history[-1]);
    if first_val <= 0.0 {
        return False;
    }
    delta = abs_diff(first_val, last_val);
    return (delta / first_val) < float(epsilon);
}


# ---------------------------------------------------------------------------
# Coverage helpers
# ---------------------------------------------------------------------------

def coverage_ratio(reserve_amount: float, price_value: float,
                   minted_units: float, demo_position: float) -> float {
    """Collateralization ratio: coverage_value / liability_value.

    Returns 0.0 when liability is zero (avoids division by zero and
    correctly signals that there is no liability to cover, not that
    coverage is infinite).

    The liability includes demo_position so that the demo fixture can
    simulate a realistic partially-minted state without requiring real
    on-chain mint history.
    """
    coverage_value  = reserve_amount * price_value;
    liability_value = (minted_units + demo_position) * price_value;
    if liability_value <= 0.0 {
        return 0.0;
    }
    return coverage_value / liability_value;
}


def justified_mint_amount(reserve_amount: float, price_value: float,
                           minted_units: float, demo_position: float) -> float {
    """Maximum additional units that may be minted without breaching 1:1 cover.

    This is the surplus reserve expressed in asset units - the difference
    between what the reserve can back and what has already been minted
    (including the demo position).  Act caps the actual mint at
    min(requested, justified) so the caller never receives more than the
    reserve currently supports.

    Returns 0.0 (not negative) when the reserve is already under-collateralised.
    """
    coverage_value  = reserve_amount * price_value;
    liability_value = (minted_units + demo_position) * price_value;
    surplus_value   = coverage_value - liability_value;
    if price_value <= 0.0 {
        return 0.0;
    }
    surplus_units = surplus_value / price_value;
    if surplus_units > 0.0 {
        return surplus_units;
    }
    return 0.0;
}


def coverage_verdict(ratio: float, min_cov: float, floor_cov: float) -> str {
    """Map a coverage ratio to green / caution / red.

    The three-tier ladder means a mint can be refused at two distinct
    thresholds: a caution when coverage is thin but technically positive,
    and red when it falls below the absolute floor.

    The caller is expected to combine this verdict with min_color()
    so that a pre-existing worse verdict on another dimension is not
    upgraded.
    """
    if ratio < floor_cov {
        return "red";
    }
    if ratio < min_cov {
        return "caution";
    }
    return "green";
}
