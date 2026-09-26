# Policy — Proof of Reserve, Jac Enforced

Every knob lives in one place, `jac/lib/policy.jac`, as the global `POLICY` dict. Walkers import it and read it at run time; none of them hard-code a threshold. Changing a value here changes the protocol's behaviour on the next walk — there is no other place to edit.

```jac
glob POLICY = {
    "max_price_age_seconds": 300,
    "max_reserve_age_seconds": 3600,
    "min_coverage_ratio": 1.00,
    "coverage_floor_ratio": 0.95,
    "flat_reserve_epsilon": 0.001,
    "flat_reserve_windows": 3,
    "price_move_epsilon": 0.005,
    "child_max_age_seconds": 3600,
    "colors": {
        "green": "pass",
        "yellow": "caution_blocks_printer",
        "red": "fail",
        "unknown": "missing_fact_halt"
    }
};
```

## Knobs

| Key | Value | Meaning | Read by | What changes when you change it |
|---|---|---|---|---|
| `max_price_age_seconds` | `300` | A price observation older than this is no longer a fact about *now*. | Freshness, Auditor | Raising it lets a stale price pass as green; lowering it turns fresh-but-not-instant prices red. Also the Auditor's age-skew ceiling between the price and reserve clocks. |
| `max_reserve_age_seconds` | `3600` | A PoR attestation older than this is expired. | Freshness | Raising it accepts older attestations as green. Reserve age above **50%** of this value is yellow, so changing it also moves the yellow band, not just the red line. |
| `min_coverage_ratio` | `1.00` | Coverage at or above this is green: reserve value ≥ liability value. | Cover, Auditor | The line between green and yellow. Below `1.00` the printer is still blocked (yellow), but the claim is reported as thin rather than failed. |
| `coverage_floor_ratio` | `0.95` | Below this, coverage is red — a real shortfall, not a thin margin. | Cover, Auditor | Widens or narrows the yellow band between `coverage_floor_ratio` and `min_coverage_ratio`. Raising it toward `1.00` makes almost any shortfall red. |
| `flat_reserve_epsilon` | `0.001` | Relative move below which a reserve series counts as unmoved (0.1%). | Cover, Auditor | The tolerance for "flat". Raise it and small real reserve movements are treated as a stuck feed; lower it and only a perfectly frozen series is flagged. |
| `flat_reserve_windows` | `3` | How many `flat_history` samples must exist before the flat check runs at all. | Cover, Auditor | The number of observations a feed must publish before "punctual but no pulse" can be claimed. Below this many samples the check is skipped, not failed. |
| `price_move_epsilon` | `0.005` | Intended as the price-side counterpart to `flat_reserve_epsilon` (0.5%). | **nothing** | **Currently inert.** Declared in `POLICY` but read by no walker, so editing it changes no behaviour today. Both the flat-reserve checks compare the reserve series against itself; the price side of "flat reserve *while price moved*" is asserted in the reason string, not measured. Wiring it means comparing first and last price in a window inside Cover and Auditor. |
| `child_max_age_seconds` | `3600` | A child backing claim older than this is stale. | Cover, Auditor | The freshness requirement on the claim *behind* the reserve. A missing or stale child is red, never unknown — the parent's "backed" status is only as good as the layer beneath it. |
| `colors` | see below | The four verdicts and what each permits. | (reference only) | Documents intent. `yellow` is `caution_blocks_printer`: a yellow stamp refuses the mint exactly as a red one does. |

## The color ladder

`jac/lib/colors.jac` orders the verdicts, and every walker combines them with `min_color`, which returns the **more severe** of two colors:

| Color | `color_rank` | Meaning | Printer |
|---|---|---|---|
| `green` | 0 | pass | open (if all three are green) |
| `yellow` | 1 | `caution_blocks_printer` | **blocked** |
| `red` | 2 | fail | blocked |
| `unknown` | 3 | `missing_fact_halt` | blocked |

Two consequences worth stating plainly:

- **Unknown outranks red.** A missing fact is treated as worse than a known failure, because a failure at least tells you what is wrong. This is why a dropped child attestation produces `unknown` from Freshness rather than a shrug.
- **There is no override.** No knob, no walker, and no API parameter lets a yellow stamp mint. The requested amount is a ceiling on the mint, never a licence to skip a stamp.

## Rationale

- **Two ages, not one.** The price is a market fact that decays in seconds; a PoR attestation is an attestation that decays in hours. Using one number for both would either expire prices too slowly or reserves too fast. `300s` / `3600s` encodes that asymmetry, and the `50%` yellow band on reserves exists because a reserve that is half-way to expiry is worth flagging before it fails.
- **A floor below the minimum.** With only `min_coverage_ratio` there would be one cliff from green to red. `coverage_floor_ratio` at `0.95` creates a band where the claim is thin but not broken — the difference between "watch this" and "refuse this".
- **Flatness is measured, not inferred.** A feed republishing a new timestamp with an unchanged amount looks perfectly fresh to any age check. The `flat_history` comparison is what catches a heartbeat with no pulse, which is why `flat_reserve_windows` requires real history before the claim can be made.
- **Every threshold is a demo lever.** An operator can walk all three demo paths by changing inputs, not code — and can change the policy itself to show the same inputs landing on a different verdict.
