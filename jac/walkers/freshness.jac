# jac/walkers/freshness.jac
# Purpose: Check timestamp freshness of price and reserve observations
# Owner walker/module: Freshness
# Spec: see PRD §6.2
# Status: IMPLEMENTED — Prompt 5

import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, Stamp }
import from jac.schemas.edges { HasPrice, HasReserve, StampedBy }
import from jac.lib.policy { POLICY }
import from jac.lib.colors { COLOR_GREEN, COLOR_YELLOW, COLOR_RED, COLOR_UNKNOWN, min_color }
import from jac.lib.utils { now_unix, abs_diff }

walker:pub Freshness {
    can run with Asset entry {
        now: int = now_unix();
        prices: list[PriceObservation] = [here ->:HasPrice:->];
        reserves: list[ReserveAttestation] = [here ->:HasReserve:->];

        color: str = COLOR_GREEN;
        reasons: list[str] = [];

        if len(prices) == 0 or len(reserves) == 0 {
            color = COLOR_UNKNOWN;
            if len(prices) == 0 {
                reasons.append("missing price observation");
            }
            if len(reserves) == 0 {
                reasons.append("missing reserve observation");
            }
        } else {
            price: PriceObservation = prices[0];
            reserve: ReserveAttestation = reserves[0];

            max_p: int = int(POLICY["max_price_age_seconds"]);
            max_r: int = int(POLICY["max_reserve_age_seconds"]);

            p_age: float = abs_diff(float(now), float(price.timestamp));
            r_age: float = abs_diff(float(now), float(reserve.timestamp));

            if p_age > float(max_p) {
                color = min_color(color, COLOR_RED);
                reasons.append("price age " + str(int(p_age)) + "s exceeds max " + str(max_p) + "s");
            } else {
                reasons.append("price age " + str(int(p_age)) + "s <= max " + str(max_p) + "s");
            }

            if r_age > float(max_r) {
                color = min_color(color, COLOR_RED);
                reasons.append("reserve age " + str(int(r_age)) + "s exceeds max " + str(max_r) + "s");
            } elif r_age > float(max_r) * 0.5 {
                color = min_color(color, COLOR_YELLOW);
                reasons.append("reserve age " + str(int(r_age)) + "s exceeds 50% of max " + str(max_r) + "s");
            } else {
                reasons.append("reserve age " + str(int(r_age)) + "s <= max " + str(max_r) + "s");
            }

            if str(price.source) == "fixture" or str(reserve.source) == "fixture" {
                reasons.append("source is fixture (labeled)");
            }
        }

        # Remove any prior Freshness stamp
        all_stamps: list[Stamp] = [here ->:StampedBy:->];
        for old_stamp in all_stamps {
            if str(old_stamp.walker_name) == "Freshness" {
                here del --> old_stamp;
            }
        }

        # Write new stamp
        stamp: Stamp = Stamp(
            walker_name="Freshness",
            color=color,
            reasons=reasons,
            timestamp=now,
            payload={}
        );
        here +>: StampedBy() :+> stamp;

        report {"walker": "Freshness", "color": color, "reasons": reasons};
    }
}
