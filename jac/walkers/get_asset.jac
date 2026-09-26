# jac/walkers/get_asset.jac
# Purpose: Read-only walker that returns full Asset graph as JSON
# Owner walker/module: shared
# Spec: see PRD §9
# Status: IMPLEMENTED — Prompt 9

import from jac.schemas.nodes { Asset }
import from jac.schemas.edges { HasPrice, HasReserve, DependsOn, HasLiability, StampedBy, MintedAs }

walker:pub GetAsset {
    has asset_id: str = "";

    can run with Asset entry {
        edges: list[dict[str, any]] = [];

        # HasPrice edges
        for p in [here ->:HasPrice:->] {
            edges.append({
                "type": "HasPrice",
                "target": {
                    "id": str(jid(p)),
                    "value": float(p.value),
                    "timestamp": int(p.timestamp),
                    "source": str(p.source),
                    "provenance": str(p.provenance),
                    "round_id": int(p.round_id),
                    "nodeType": "PriceObservation"
                }
            });
        }

        # HasReserve edges + DependsOn children
        for r in [here ->:HasReserve:->] {
            edges.append({
                "type": "HasReserve",
                "target": {
                    "id": str(jid(r)),
                    "amount": float(r.amount),
                    "timestamp": int(r.timestamp),
                    "source": str(r.source),
                    "feed_address": str(r.feed_address),
                    "round_id": int(r.round_id),
                    "answered_in_round": int(r.answered_in_round),
                    "nodeType": "ReserveAttestation"
                }
            });
            for ch in [r ->:DependsOn:->] {
                edges.append({
                    "type": "DependsOn",
                    "source": str(jid(r)),
                    "target": {
                        "id": str(jid(ch)),
                        "asset_id": str(ch.asset_id),
                        "amount": float(ch.amount),
                        "timestamp": int(ch.timestamp),
                        "source": str(ch.source),
                        "present": bool(ch.present),
                        "provenance": str(ch.provenance),
                        "nodeType": "ChildClaim"
                    }
                });
            }
        }

        # HasLiability edges
        for l in [here ->:HasLiability:->] {
            edges.append({
                "type": "HasLiability",
                "target": {
                    "id": str(jid(l)),
                    "minted_units": float(l.minted_units),
                    "vault_shares": float(l.vault_shares),
                    "demo_position": float(l.demo_position),
                    "description": str(l.description),
                    "nodeType": "Liability"
                }
            });
        }

        # StampedBy edges
        for s in [here ->:StampedBy:->] {
            edges.append({
                "type": "StampedBy",
                "target": {
                    "id": str(jid(s)),
                    "walker_name": str(s.walker_name),
                    "color": str(s.color),
                    "reasons": list(s.reasons),
                    "timestamp": int(s.timestamp),
                    "payload": dict(s.payload),
                    "nodeType": "Stamp"
                }
            });
        }

        # MintedAs edges
        for m in [here ->:MintedAs:->] {
            edges.append({
                "type": "MintedAs",
                "target": {
                    "id": str(jid(m)),
                    "tx_hash": str(m.tx_hash),
                    "token_address": str(m.token_address),
                    "nft_token_id": int(m.nft_token_id),
                    "minted_amount": float(m.minted_amount),
                    "coverage_used": float(m.coverage_used),
                    "price_time": int(m.price_time),
                    "reserve_time": int(m.reserve_time),
                    "stamp_summary": dict(m.stamp_summary),
                    "timestamp": int(m.timestamp),
                    "nodeType": "MintRecord"
                }
            });
        }

        payload = {
            "id": str(here.id),
            # `id` is the business id ("asset-1"); `node_id` is the Jac graph node
            # id. They are different things and the frontend needs both: `node_id`
            # is what every walker call passes as its path param.
            "node_id": str(jid(here)),
            "name": str(here.name),
            "symbol": str(here.symbol),
            "chain": str(here.chain),
            "token_address": str(here.token_address),
            "overall_status": str(here.overall_status),
            "created_at": int(here.created_at),
            "edges": edges
        };

        report payload;
    }
}
