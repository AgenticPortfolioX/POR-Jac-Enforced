
import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, Stamp }
import from jac.schemas.edges { HasPrice, HasReserve, StampedBy }
import from jac.lib.policy { POLICY }
import from jac.lib.colors { COLOR_GREEN, COLOR_CAUTION, COLOR_RED, COLOR_UNKNOWN, min_color }
import from jac.lib.utils { now_unix, abs_diff, PORJE_TRACE }

walker:pub Freshness {
    can run with Asset entry {
        if PORJE_TRACE { print(f"[TRACE] Freshness: entry on {str(jid(here))}"); }
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
                color = min_color(color, COLOR_CAUTION);
                reasons.append("reserve age " + str(int(r_age)) + "s exceeds 50% of max " + str(max_r) + "s");
            } else {
                reasons.append("reserve age " + str(int(r_age)) + "s <= max " + str(max_r) + "s");
            }

            if str(price.source) == "fixture" or str(reserve.source) == "fixture" {
                reasons.append("source is fixture (labeled)");
            }
        }

        # Upsert this walker's stamp - exactly one Freshness stamp per asset.
        # NOTE: do NOT delete-then-recreate here. When several walkers are spawned
        # from a single parent ability (DemoControl spawns Freshness, Cover and
        # Auditor in one run), each child's commit re-writes the asset's edge set
        # from its own snapshot, restoring edges a sibling had just deleted. The
        # deletion is silently lost and stamps accumulate one per run, which would
        # let Act read a stale green. Mutating the existing node in place has no
        # edge to lose, so the invariant holds no matter how the walker is driven.
        found: bool = False;
        for old_stamp in [here ->:StampedBy:->] {
            if str(old_stamp.walker_name) == "Freshness" {
                old_stamp.color = color;
                old_stamp.reasons = reasons;
                old_stamp.timestamp = now;
                old_stamp.payload = {};
                found = True;
            }
        }

        if not found {
            stamp: Stamp = Stamp(
                walker_name="Freshness",
                color=color,
                reasons=reasons,
                timestamp=now,
                payload={}
            );
            here +>: StampedBy() :+> stamp;
        }

        if PORJE_TRACE { print(f"[TRACE] Freshness: exit color={color}"); }
        report {"walker": "Freshness", "color": color, "reasons": reasons};
    }
}
