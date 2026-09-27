
import from jac.schemas.nodes { Asset, Stamp }
import from jac.schemas.edges { StampedBy }
import from jac.lib.utils { PORJE_TRACE }
import from jac.lib.term_colors { RESET, BOLD, DIM, SEP, FG_GREEN, FG_YELLOW, FG_RED, FG_CYAN, FG_WHITE, BG_GREEN, BG_RED, BG_YELLOW, BG_BLACK }

walker:pub Counsel {
    can run with Asset entry {
        if PORJE_TRACE { print(f"[TRACE] Counsel: entry on {str(jid(here))}"); }
        stamps = [here ->:StampedBy:->];

        by_name = {};
        for s in stamps {
            by_name[str(s.walker_name)] = s;
        }

        required = ["Freshness", "Cover", "Auditor"];
        missing: list[str] = [];
        for name in required {
            if name not in by_name {
                missing.append(name);
            }
        }

        if len(missing) > 0 {
            report {"spoken": False, "reason": "stamps incomplete", "missing": missing};
            return;
        }

        f: Stamp = by_name["Freshness"];
        c: Stamp = by_name["Cover"];
        a: Stamp = by_name["Auditor"];

        justified = float(c.payload.get("justified_amount", 0.0));
        ratio = float(c.payload.get("coverage_ratio", 0.0));

        narration: str = (
            "Freshness " + str(f.color) + ": " + ", ".join(f.reasons) + ". " +
            "Cover " + str(c.color) + ": coverage ratio " + str(ratio) + ", justified " + str(justified) + ". " +
            "Auditor " + str(a.color) + ": " + "; ".join(a.reasons) + ". "
        );

        all_green = (
            str(f.color) == "green" and
            str(c.color) == "green" and
            str(a.color) == "green"
        );

        if all_green and justified > 0.0 {
            narration = narration + "The mint was justified for " + str(justified) + " units.";
            print("");
            print(BOLD + BG_GREEN + "  [PASS] MINT APPROVED: " + str(justified) + " units authorized  " + RESET);
            print("");
        } else {
            narration = narration + "No mint was justified. A PoR page might still show a number; this printer will not treat that number as a permit.";
            print("");
            print(BOLD + BG_RED + "  [FAIL] MINT BLOCKED: Proof of Reserve conditions not met  " + RESET);
            print("");
        }

        if PORJE_TRACE { print(f"[TRACE] Counsel: spoken={True}"); }
        report {"spoken": True, "narration": narration};
    }
}
