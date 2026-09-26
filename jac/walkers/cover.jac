# jac/walkers/cover.jac
# Purpose: Compute coverage ratio and justified mint amount; write color Stamp
# Owner walker/module: Cover
# Spec: see PRD §6.4
# Status: IMPLEMENTED — Prompt 6

import from jac.schemas.nodes { Asset, Stamp }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy }
import from jac.lib.policy { POLICY }
import from jac.lib.colors { COLOR_GREEN, COLOR_YELLOW, COLOR_RED, COLOR_UNKNOWN, min_color }
import from jac.lib.utils { now_unix, abs_diff }

walker:pub Cover {
    can run with Asset entry {
        now = now_unix();
        prices = [here ->:HasPrice:->];
        reserves = [here ->:HasReserve:->];
        liabs = [here ->:HasLiability:->];

        color: str = COLOR_GREEN;
        reasons: list[str] = [];
        justified = 0.0;
        ratio = 0.0;

        if len(prices) == 0 or len(reserves) == 0 or len(liabs) == 0 {
            color = COLOR_UNKNOWN;
            reasons.append("missing price, reserve, or liability");
        } else {
            price = prices[0];
            reserve = reserves[0];
            liab = liabs[0];

            min_cov = float(POLICY["min_coverage_ratio"]);
            floor_cov = float(POLICY["coverage_floor_ratio"]);
            child_max_age = int(POLICY["child_max_age_seconds"]);
            flat_eps = float(POLICY["flat_reserve_epsilon"]);
            flat_windows = int(POLICY["flat_reserve_windows"]);

            # Child claim check
            children = [reserve ->:DependsOn:->];
            if len(children) == 0 or bool(children[0].present) == False {
                color = min_color(color, COLOR_RED);
                reasons.append("child attestation: missing");
            } elif (now - int(children[0].timestamp)) > child_max_age {
                color = min_color(color, COLOR_RED);
                reasons.append("child attestation: stale");
            } else {
                reasons.append("child attestation: present");
            }

            # Flat reserve check
            if float(reserve.amount) > 0.0 {
                hist = getattr(reserve, "flat_history", []);
                if len(hist) >= flat_windows {
                    delta = abs_diff(float(hist[0]), float(hist[-1]));
                    if delta / float(hist[0]) < flat_eps {
                        color = min_color(color, COLOR_YELLOW);
                        reasons.append("flat reserve while price moved (punctual but no pulse)");
                    }
                }
            }

            # Coverage calculation
            coverage_value = float(reserve.amount) * float(price.value);
            liability_value = (float(liab.minted_units) + float(liab.demo_position)) * float(price.value);
            if liability_value > 0.0 {
                ratio = coverage_value / liability_value;
            } else {
                ratio = 0.0;
            }

            if ratio < floor_cov {
                color = min_color(color, COLOR_RED);
                reasons.append("coverage ratio " + str(ratio) + " < floor " + str(floor_cov));
            } elif ratio < min_cov {
                color = min_color(color, COLOR_YELLOW);
                reasons.append("coverage ratio " + str(ratio) + " < min " + str(min_cov));
            } else {
                reasons.append("coverage ratio " + str(ratio) + " >= min " + str(min_cov));
            }

            # Justified amount
            max_mintable = (coverage_value / float(price.value)) - float(liab.minted_units) - float(liab.demo_position);
            if max_mintable > 0.0 {
                justified = max_mintable;
            } else {
                justified = 0.0;
            }
            reasons.append("justified amount: " + str(justified));
        }

        # Remove prior Cover stamp
        for old_stamp in [here ->:StampedBy:->] {
            if str(old_stamp.walker_name) == "Cover" {
                here del --> old_stamp;
            }
        }

        stamp = Stamp(
            walker_name="Cover",
            color=color,
            reasons=reasons,
            timestamp=now,
            payload={"justified_amount": float(justified), "coverage_ratio": float(ratio)}
        );
        here +>: StampedBy() :+> stamp;

        report {
            "walker": "Cover",
            "color": color,
            "reasons": reasons,
            "justified_amount": float(justified),
            "coverage_ratio": float(ratio)
        };
    }
}
