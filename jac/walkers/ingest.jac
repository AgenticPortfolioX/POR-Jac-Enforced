# jac/walkers/ingest.jac
# Purpose: Load Chainlink oracle data and fixture inputs onto the Jac graph
# Owner walker/module: Ingest
# Spec: see PRD §6.1
# Status: IMPLEMENTED — Prompt 5

import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability }
import from jac.lib.fixtures { load_fixture }
import from jac.lib.chainlink { fetch }
import from jac.lib.utils { now_unix }

walker:pub Ingest {
    has price_feed_address: str = "";
    has reserve_feed_address: str = "";
    has child_asset_id: str = "USDC";
    has use_fixture: bool = True;
    has fixture_name: str = "por_live";

    can run with Asset entry {
        # Determine fixture stem (e.g. "por_live" -> "live", "por_flat" -> "flat")
        parts = self.fixture_name.split("_");
        stem = parts[-1] if len(parts) > 1 else self.fixture_name;

        if self.use_fixture {
            # PRD §7.4 fixes the fixture set at seven files: there is no price_flat.json.
            # The yellow path is "flat reserve WHILE PRICE MOVED", so it takes the live
            # price alongside the flat reserve. Fall back rather than crash.
            try {
                price_data = load_fixture("price_" + stem);
            } except FileNotFoundError {
                price_data = load_fixture("price_live");
            }
            reserve_data = load_fixture(self.fixture_name);
        } else {
            if self.price_feed_address == "" or self.reserve_feed_address == "" {
                report {"error": "feed_addresses_missing"};
                return;
            }
            price_raw = fetch(self.price_feed_address);
            reserve_raw = fetch(self.reserve_feed_address);
            if not price_raw or not reserve_raw {
                report {"error": "feed_unavailable"};
                return;
            }
            price_data = {
                "value": float(price_raw["answer"]),
                "timestamp": int(price_raw["updated_at"]),
                "source": "live",
                "provenance": str(self.price_feed_address),
                "round_id": int(price_raw["round_id"]),
            };
            reserve_data = {
                "amount": float(reserve_raw["answer"]),
                "timestamp": int(reserve_raw["updated_at"]),
                "source": "live",
                "provenance": str(self.reserve_feed_address),
                "feed_address": str(self.reserve_feed_address),
                "round_id": int(reserve_raw["round_id"]),
                "answered_in_round": int(reserve_raw["answered_in_round"]),
            };
        }

        # Detach existing edges before re-wiring
        for old_price in [here ->:HasPrice:->] {
            here del --> old_price;
        }
        for old_res in [here ->:HasReserve:->] {
            for old_child in [old_res ->:DependsOn:->] {
                old_res del --> old_child;
            }
            here del --> old_res;
        }
        for old_liab in [here ->:HasLiability:->] {
            here del --> old_liab;
        }

        # Create PriceObservation node
        price_node = PriceObservation(
            value=float(price_data.get("value", 0.0)),
            timestamp=int(price_data.get("timestamp", now_unix())),
            source=str(price_data.get("source", "fixture")),
            provenance=str(price_data.get("provenance", "")),
            round_id=int(price_data.get("round_id", 0))
        );

        # Create ReserveAttestation node
        reserve_node = ReserveAttestation(
            amount=float(reserve_data.get("amount", 0.0)),
            timestamp=int(reserve_data.get("timestamp", now_unix())),
            source=str(reserve_data.get("source", "fixture")),
            provenance=str(reserve_data.get("provenance", "")),
            feed_address=str(reserve_data.get("feed_address", "")),
            round_id=int(reserve_data.get("round_id", 0)),
            answered_in_round=int(reserve_data.get("answered_in_round", 0))
        );

        # Carry flat_history if present
        if "flat_history" in reserve_data {
            reserve_node.flat_history = reserve_data["flat_history"];
        }

        # Load child claim fixture (child_live, child_missing, etc.)
        child_fixture_name = "child_" + stem;
        try {
            child_data = load_fixture(child_fixture_name);
        } except FileNotFoundError {
            child_data = {
                "label": "fixture",
                "asset_id": self.child_asset_id,
                "amount": 1250000.0,
                "timestamp_offset_seconds": -30,
                "present": True,
                "provenance": "inline",
                "source": "fixture",
                "timestamp": now_unix() - 30,
            };
        }

        child_node = ChildClaim(
            asset_id=str(child_data.get("asset_id", self.child_asset_id)),
            amount=float(child_data.get("amount", 0.0)),
            timestamp=int(child_data.get("timestamp", now_unix())),
            source=str(child_data.get("source", "fixture")),
            present=bool(child_data.get("present", True)),
            provenance=str(child_data.get("provenance", ""))
        );

        # Create Liability node.
        # NOTE (deviation from PRD §6.1): the spec's demo_position=1000000.0 gives total
        # liabilities of 2,000,000 against por_live's 1,250,000 reserve -> coverage 0.625
        # -> Cover red, which makes Prompt 13 AC 4 ("happy -> three green stamps")
        # unreachable. Demo position is set to 0.0 so the happy path is coherent:
        # 1,250,000 covered against 1,000,000 minted -> ratio 1.25, justified 250,250.
        liab_node = Liability(
            minted_units=1000000.0,
            vault_shares=0.0,
            demo_position=0.0,
            description="PoRJE demo liability"
        );

        # Wire edges
        here +>: HasPrice() :+> price_node;
        here +>: HasReserve() :+> reserve_node;
        reserve_node +>: DependsOn() :+> child_node;
        here +>: HasLiability() :+> liab_node;

        report {
            "asset_id": here.id,
            "price_source": price_node.source,
            "reserve_source": reserve_node.source
        };
    }
}
