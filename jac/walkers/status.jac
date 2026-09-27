
# status.jac
#
# The Status walker returns a lightweight health snapshot of the asset graph
# without touching any stamps or modifying state.  It is a read-only
# diagnostic endpoint: safe to call at any time, including mid-walk.
#
# Endpoint: POST /walker/Status/{node_id}
#
# Response shape:
# {
#   "asset_id":     str,
#   "node_id":      str,
#   "overall_status": str,
#   "graph": {
#     "has_price":   bool,
#     "has_reserve": bool,
#     "has_liability": bool,
#     "has_child":   bool,
#     "stamp_count": int,
#     "mint_count":  int
#   },
#   "stamps": {
#     "Freshness": {"color": str, "ts": int} | null,
#     "Cover":     {"color": str, "ts": int, "justified": float} | null,
#     "Auditor":   {"color": str, "ts": int} | null
#   },
#   "ready_to_act": bool,
#   "blocked_reason": str | null
# }

import from jac.schemas.nodes { Asset, Stamp, MintRecord }
import from jac.schemas.edges { HasPrice, HasReserve, HasLiability, DependsOn, StampedBy, MintedAs }
import from jac.lib.utils { PORJE_TRACE }


walker:pub Status {
    # No parameters: Status is purely a reader of the node it is spawned on.

    can run with Asset entry {
        if PORJE_TRACE { print(f"[TRACE] Status: entry on {str(jid(here))}"); }

        # ------------------------------------------------------------------ #
        # 1.  Collect graph structure facts
        # ------------------------------------------------------------------ #
        prices    = [here ->:HasPrice:->];
        reserves  = [here ->:HasReserve:->];
        liabs     = [here ->:HasLiability:->];
        mints     = [here ->:MintedAs:->];
        all_stamps = [here ->:StampedBy:->];

        has_price     = len(prices)   > 0;
        has_reserve   = len(reserves) > 0;
        has_liability = len(liabs)    > 0;
        has_child     = False;
        if has_reserve {
            children  = [reserves[0] ->:DependsOn:->];
            has_child = len(children) > 0;
        }

        # ------------------------------------------------------------------ #
        # 2.  Index stamps by walker name
        # ------------------------------------------------------------------ #
        by_name: dict = {};
        for s in all_stamps {
            by_name[str(s.walker_name)] = s;
        }

        freshness_info: dict = {};
        cover_info:     dict = {};
        auditor_info:   dict = {};

        if "Freshness" in by_name {
            f = by_name["Freshness"];
            freshness_info = {"color": str(f.color), "ts": int(f.timestamp)};
        }
        if "Cover" in by_name {
            c = by_name["Cover"];
            cover_info = {
                "color":     str(c.color),
                "ts":        int(c.timestamp),
                "justified": float(c.payload.get("justified_amount", 0.0))
            };
        }
        if "Auditor" in by_name {
            a = by_name["Auditor"];
            auditor_info = {"color": str(a.color), "ts": int(a.timestamp)};
        }

        # ------------------------------------------------------------------ #
        # 3.  Determine readiness
        # ------------------------------------------------------------------ #
        blocked_reason: str = "";
        required = ["Freshness", "Cover", "Auditor"];
        all_present = True;
        all_green   = True;

        for name in required {
            if name not in by_name {
                all_present = False;
                blocked_reason = name + " stamp missing";
                break;
            }
            if str(by_name[name].color) != "green" {
                all_green = False;
                if not blocked_reason {
                    blocked_reason = name + " stamp is " + str(by_name[name].color);
                }
            }
        }

        ready = all_present and all_green;
        if ready {
            justified_amount = float(by_name["Cover"].payload.get("justified_amount", 0.0));
            if justified_amount <= 0.0 {
                ready = False;
                blocked_reason = "justified amount is zero";
            }
        }

        if PORJE_TRACE { print(f"[TRACE] Status: ready={ready}, blocked={blocked_reason}"); }

        report {
            "asset_id":       str(here.id),
            "node_id":        str(jid(here)),
            "overall_status": str(here.overall_status),
            "graph": {
                "has_price":    has_price,
                "has_reserve":  has_reserve,
                "has_liability": has_liability,
                "has_child":    has_child,
                "stamp_count":  len(all_stamps),
                "mint_count":   len(mints)
            },
            "stamps": {
                "Freshness": freshness_info if freshness_info else None,
                "Cover":     cover_info     if cover_info     else None,
                "Auditor":   auditor_info   if auditor_info   else None
            },
            "ready_to_act":   ready,
            "blocked_reason": blocked_reason if blocked_reason else None
        };
    }
}
