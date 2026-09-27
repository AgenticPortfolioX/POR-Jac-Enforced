
import from jac.schemas.nodes { Asset }

walker:pub SeedAsset {
    has id: str = "asset-1";
    has name: str = "PoR pUSD";
    has symbol: str = "pUSD";
    has chain: str = "sepolia";
    has token_address: str = "";
    has created_at: int = 0;

    can run with Root entry {
        # Check if asset already exists
        for existing in [here -->[?:Asset]] {
            if str(existing.id) == str(self.id) {
                report {
                    "asset_id": str(existing.id),
                    "node_id": str(jid(existing)),
                    "created": False
                };
                return;
            }
        }

        # Create new Asset and link from root
        asset = Asset(
            id=str(self.id),
            name=str(self.name),
            symbol=str(self.symbol),
            chain=str(self.chain),
            token_address=str(self.token_address),
            overall_status="unknown",
            created_at=int(self.created_at)
        );
        here ++> asset;
        # node_id is required by callers: walkers declared `with Asset entry` only run
        # when spawned ON the asset node, i.e. POST /walker/{Name}/{node_id}.
        # `jid()` is the Jac builtin for the graph node id (JacRuntimeInterface.object_ref).
        # Do not write `asset.__jac__.id.hex`: it is the same value at runtime, but the
        # static checker rejects it (E1030, "Asset has no attribute __jac__").
        report {
            "asset_id": str(asset.id),
            "node_id": str(jid(asset)),
            "created": True
        };
    }
}
