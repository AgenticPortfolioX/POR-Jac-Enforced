# jac/schemas/nodes.jac
# Purpose: Graph node definitions for Proof of Reserve
# Owner walker/module: shared
# Spec: see PRD §3.1
# Status: SCAFFOLD — no logic implemented

node Asset {
    has asset_id: str;
    has symbol: str;
    has total_reserves: float = 0.0;
    has status: str = "unknown";
    has last_updated: int = 0;
}

node PriceObservation {
    has feed_address: str;
    has value: float;
    has round_id: int;
    has timestamp: int;
    has status: str = "unknown";
}

node ReserveAttestation {
    has feed_address: str;
    has amount: float;
    has round_id: int;
    has timestamp: int;
    has provenance: str;
    has status: str = "unknown";
}

node ChildClaim {
    has asset_id: str;
    has amount: float;
    has timestamp: int;
    has provenance: str;
    has present: bool = True;
    has status: str = "unknown";
}

node Liability {
    has liability_id: str;
    has token_address: str;
    has total_minted: float = 0.0;
    has target_coverage: float = 1.0;
    has last_audited: int = 0;
}

node Stamp {
    has stamp_id: str;
    has color: str = "unknown";
    has freshness_score: float = 0.0;
    has coverage_ratio: float = 0.0;
    has reason: str = "";
    has timestamp: int = 0;
}

node MintRecord {
    has tx_hash: str;
    has recipient: str;
    has amount: float;
    has coverage_at_mint: float;
    has timestamp: int;
    has status: str;
}
