import from jac.schemas.nodes { Asset }
import from jac.walkers.seed_asset { SeedAsset }
import from jac.walkers.demo_control { DemoControl }
import from jac.walkers.get_asset { GetAsset }
import from jac.walkers.act { Act }
import from jac.walkers.counsel { Counsel }

walker:pub DemoOrchestrator {
    has path: str = "happy";
    has asset_id: str = "asset-1";
    has requested_amount: float = 1000000.0;
    has recipient: str = "0x0000000000000000000000000000000000000000";
    has token_address: str = "";
    has attestation_address: str = "";

    can run with Root entry {
        # 1. Seed Asset
        here spawn SeedAsset(
            id=self.asset_id,
            name="PoR pUSD",
            symbol="pUSD",
            chain="sepolia",
            token_address=self.token_address,
            created_at=0
        );

        # Find the asset node
        asset_node: Asset = null;
        for existing in [here -->[?:Asset]] {
            if str(existing.id) == str(self.asset_id) {
                asset_node = existing;
                break;
            }
        }

        if not asset_node {
            report {"error": "Failed to seed or find asset"};
            return;
        }

        # 2. DemoControl (Ingest, Freshness, Cover, Auditor)
        asset_node spawn DemoControl(path=self.path);

        # 3. GetAsset (Inspect graph structure)
        asset_node spawn GetAsset(asset_id=self.asset_id);

        # 4. Act (EVM execution)
        asset_node spawn Act(
            requested_amount=self.requested_amount,
            recipient=self.recipient,
            token_address=self.token_address,
            attestation_address=self.attestation_address
        );

        # 5. Counsel (Explainability summary)
        asset_node spawn Counsel();

        report {"status": "orchestrated", "path": self.path};
    }
}
