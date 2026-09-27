
import from jac.lib { evm_py }
import json;

import from jac.schemas.nodes { Asset, MintRecord }
import from jac.schemas.edges { HasPrice, HasReserve, StampedBy, MintedAs }
import from jac.lib.utils { now_unix }

walker:pub Act {
    has requested_amount: float = 0.0;
    has recipient: str = "";
    has token_address: str = "";
    has attestation_address: str = "";

    can run with Asset entry {
        stamps = [here ->:StampedBy:->];
        by_name = {};
        for s in stamps {
            by_name[str(s.walker_name)] = s;
        }

        required = ["Freshness", "Cover", "Auditor"];
        for name in required {
            if name not in by_name {
                report {"minted": False, "reason": name + " stamp missing"};
                return;
            }
            if str(by_name[name].color) != "green" {
                report {"minted": False, "reason": name + " stamp is " + str(by_name[name].color)};
                return;
            }
        }

        justified = float(by_name["Cover"].payload.get("justified_amount", 0.0));
        amount = min(float(self.requested_amount), float(justified));

        if amount <= 0.0 {
            report {"minted": False, "reason": "justified amount is zero"};
            return;
        }

        prices = [here ->:HasPrice:->];
        reserves = [here ->:HasReserve:->];
        price_time = int(prices[0].timestamp) if len(prices) > 0 else 0;
        reserve_time = int(reserves[0].timestamp) if len(reserves) > 0 else 0;

        reason_json = json.dumps({
            "rule": "PoRJE:Act",
            "justified": float(justified),
            "requested": float(self.requested_amount)
        });

        stamp_summary = {
            "Freshness": str(by_name["Freshness"].color),
            "Cover": str(by_name["Cover"].color),
            "Auditor": str(by_name["Auditor"].color)
        };

        # NOTE: evm_py.<fn> is resolved as a module attribute at CALL time (the Jac
        # compiler inlines the module path, it does not bind a local `evm_py`), which
        # is what lets tests monkey-patch the module attribute. Do not rewrite this as
        # `from jac.lib.evm_py import mint` (binds at import time, breaks the spy) or
        # `getattr(evm_py, ...)` (name is not bound at runtime).
        # `jac check` reports E1032 here: the static checker cannot introspect .py
        # modules. See docs/architecture.md § Testability.
        tx_hash: str = "";
        nft_id: int = 0;
        try {
            tx_hash = str(evm_py.mint(
                str(self.token_address),
                str(self.recipient),
                float(amount),
                str(reason_json)
            ));

            nft_id = int(evm_py.mint_attestation(
                str(self.attestation_address),
                str(self.recipient),
                float(amount),
                float(justified),
                int(price_time),
                int(reserve_time),
                dict(stamp_summary)
            ));
        } except Exception as e {
            # Fail closed. A chain call that cannot be completed — node has no funded
            # key, RPC unreachable, contract reverted — must surface as an explicit
            # refusal with no MintRecord written, never as an unhandled exception and
            # never as a false success. Invariant 6 holds in both directions: no
            # MintRecord without a mint, and no mint reported without a receipt.
            report {"minted": False, "reason": "evm mint failed: " + str(e)};
            return;
        }

        record = MintRecord(
            tx_hash=str(tx_hash),
            token_address=str(self.token_address),
            nft_token_id=int(nft_id),
            minted_amount=float(amount),
            coverage_used=float(justified),
            price_time=int(price_time),
            reserve_time=int(reserve_time),
            stamp_summary=dict(stamp_summary),
            timestamp=now_unix()
        );

        here +>: MintedAs() :+> record;
        here.overall_status = "minted";

        report {
            "minted": True,
            "amount": float(amount),
            "justified": float(justified),
            "tx": str(tx_hash),
            "nft_id": int(nft_id)
        };
    }
}
