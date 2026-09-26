# jac/schemas/nodes.jac
# Purpose: Graph node archetypes for Proof of Reserve, Jac Enforced
# Owner walker/module: shared
# Spec: see PRD §3.1
# Status: IMPLEMENTED — Prompt 2

node Asset {
    has :pub id: str;
    has :pub name: str;
    has :pub symbol: str;
    has :pub chain: str;
    has :pub token_address: str;
    has :pub created_at: int;
    has :pub overall_status: str = "unknown";
}

node PriceObservation {
    has :pub value: float;
    has :pub timestamp: int;
    has :pub source: str;
    has :pub provenance: str;
    has :pub round_id: int = 0;
}

node ReserveAttestation {
    has :pub amount: float;
    has :pub timestamp: int;
    has :pub source: str;
    has :pub provenance: str;
    has :pub feed_address: str;
    has :pub round_id: int = 0;
    has :pub answered_in_round: int = 0;
    has :pub flat_history: list[any] = [];
}

node ChildClaim {
    has :pub asset_id: str;
    has :pub amount: float;
    has :pub timestamp: int;
    has :pub source: str;
    has :pub present: bool;
    has :pub provenance: str;
}

node Liability {
    has :pub minted_units: float;
    has :pub vault_shares: float;
    has :pub demo_position: float;
    has :pub description: str;
}

node Stamp {
    has :pub walker_name: str;
    has :pub color: str;
    has :pub reasons: list[str];
    has :pub timestamp: int;
    has :pub payload: dict[str, any] = {};
}

node MintRecord {
    has :pub tx_hash: str;
    has :pub token_address: str;
    has :pub nft_token_id: int;
    has :pub minted_amount: float;
    has :pub coverage_used: float;
    has :pub price_time: int;
    has :pub reserve_time: int;
    has :pub stamp_summary: dict[str, any];
    has :pub timestamp: int;
}
