# Test typed traversal - Jac 0.13.5 correct syntax
node Stamp { has walker_name: str; has color: str = "unknown"; has reasons: list[str] = []; has timestamp: int = 0; has payload: dict[str, any] = {}; }
node Asset { has id: str; has name: str; has symbol: str; has chain: str; has token_address: str; has created_at: int; has overall_status: str = "unknown"; }
edge StampedBy {}

walker:pub TestStampDel {
    can run with Asset entry {
        # Get all StampedBy edges - typed traversal
        existing = [here ->:StampedBy:->];
        for s in existing {
            here del --> s;
        }
        report {"ok": True};
    }
}
