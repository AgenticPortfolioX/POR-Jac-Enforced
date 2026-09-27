
import from jac.schemas.nodes { Asset, Stamp }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy }
import from jac.lib.policy { POLICY }
import from jac.lib.colors { COLOR_GREEN, COLOR_CAUTION, COLOR_RED, COLOR_UNKNOWN, min_color }
import from jac.lib.utils { now_unix, abs_diff, PORJE_TRACE }
import from jac.lib.term_colors { RESET, BOLD, DIM, SEP, FG_GREEN, FG_YELLOW, FG_RED, FG_GRAY, FG_WHITE }

walker:pub Auditor {
    can run with Asset entry {
        if PORJE_TRACE { print(f"[TRACE] Auditor: entry on {str(jid(here))}"); }
        now = now_unix();
        prices = [here ->:HasPrice:->];
        reserves = [here ->:HasReserve:->];
        liabs = [here ->:HasLiability:->];

        color: str = COLOR_GREEN;
        findings: list[str] = [];

        if len(prices) == 0 or len(reserves) == 0 {
            color = COLOR_UNKNOWN;
            findings.append("age skew - unknown (missing price or reserve)");
            findings.append("flat reserve - unknown");
            findings.append("child attestation - unknown");
            findings.append("liability cover - unknown");
        } else {
            price = prices[0];
            reserve = reserves[0];

            max_price_age = int(POLICY["max_price_age_seconds"]);
            min_cov = float(POLICY["min_coverage_ratio"]);
            floor_cov = float(POLICY["coverage_floor_ratio"]);
            flat_eps = float(POLICY["flat_reserve_epsilon"]);
            flat_windows = int(POLICY["flat_reserve_windows"]);
            child_max_age = int(POLICY["child_max_age_seconds"]);

            # 1. Age skew
            skew = abs_diff(float(price.timestamp), float(reserve.timestamp));
            if skew > float(max_price_age) {
                color = min_color(color, COLOR_RED);
                findings.append("age skew - " + str(int(skew)) + "s exceeds " + str(max_price_age) + "s");
            } else {
                findings.append("age skew - none");
            }

            # 2. Flat reserve
            hist = getattr(reserve, "flat_history", []);
            if len(hist) >= flat_windows {
                delta = abs_diff(float(hist[0]), float(hist[-1]));
                if delta / float(hist[0]) < flat_eps {
                    color = min_color(color, COLOR_CAUTION);
                    findings.append("flat reserve - unchanged across " + str(flat_windows) + " windows while price moved");
                } else {
                    findings.append("flat reserve - none");
                }
            } else {
                findings.append("flat reserve - none");
            }

            # 3. Child attestation
            children = [reserve ->:DependsOn:->];
            if len(children) == 0 {
                color = min_color(color, COLOR_RED);
                findings.append("child attestation - missing");
            } elif bool(children[0].present) == False {
                color = min_color(color, COLOR_RED);
                findings.append("child attestation - missing");
            } elif (now - int(children[0].timestamp)) > child_max_age {
                color = min_color(color, COLOR_RED);
                findings.append("child attestation - stale");
            } else {
                findings.append("child attestation - present");
            }

            # 4. Liability cover
            if len(liabs) == 0 {
                color = min_color(color, COLOR_UNKNOWN);
                findings.append("liability cover - unknown");
            } else {
                liab = liabs[0];
                coverage_value = float(reserve.amount) * float(price.value);
                liability_value = (float(liab.minted_units) + float(liab.demo_position)) * float(price.value);
                if liability_value > 0.0 {
                    ratio = coverage_value / liability_value;
                } else {
                    ratio = 0.0;
                }
                if ratio < floor_cov {
                    color = min_color(color, COLOR_RED);
                    findings.append("liability cover - fails");
                } elif ratio < min_cov {
                    color = min_color(color, COLOR_CAUTION);
                    findings.append("liability cover - thin");
                } else {
                    findings.append("liability cover - holds");
                }
            }
        }

        # Upsert this walker's stamp - exactly one Auditor stamp per asset.
        # See jac/walkers/freshness.jac for why this mutates in place instead of
        # deleting the prior stamp: sibling spawns from one parent ability restore
        # each other's deleted edges, so deletion does not survive.
        found: bool = False;
        for old_stamp in [here ->:StampedBy:->] {
            if str(old_stamp.walker_name) == "Auditor" {
                old_stamp.color = color;
                old_stamp.reasons = findings;
                old_stamp.timestamp = now;
                old_stamp.payload = {};
                found = True;
            }
        }

        if not found {
            stamp: Stamp = Stamp(
                walker_name="Auditor",
                color=color,
                reasons=findings,
                timestamp=now,
                payload={}
            );
            here +>: StampedBy() :+> stamp;
        }

        verdict_color: str = FG_GREEN;
        verdict_icon: str  = "[PASS]";
        if color == COLOR_CAUTION {
            verdict_color = FG_YELLOW;
            verdict_icon  = "[WARN]";
        } elif color == COLOR_RED or color == COLOR_UNKNOWN {
            verdict_color = FG_RED;
            verdict_icon  = "[FAIL]";
        }
        print(BOLD + FG_WHITE + "  [AUDITOR]   " + verdict_icon + " " + verdict_color + str(color).upper() + RESET);
        for f in findings {
            print(DIM + "    • " + str(f) + RESET);
        }
        if PORJE_TRACE { print(f"[TRACE] Auditor: exit color={color}"); }
        report {"walker": "Auditor", "color": color, "reasons": findings};
    }
}
