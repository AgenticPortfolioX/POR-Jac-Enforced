# jac/walkers/seed_asset.jac
# Purpose: Idempotent walker that creates the root Asset node if not yet seeded
# Owner walker/module: shared
# Spec: see PRD §9
# Status: IMPLEMENTED — Prompt 9

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
                report {"asset_id": str(existing.id), "created": False};
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
        report {"asset_id": str(asset.id), "created": True};
    }
}
