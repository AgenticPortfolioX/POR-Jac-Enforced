# INVENTORY

> Regenerated 2026-09-27 after audit. Previous version claimed 17 tests across 5 files - this is still correct for the git tree. The run tree at /home/grams121/porje has 63 tests across 12 files; that tree is not present on this host and those counts are not reproducible here.

## 0.0 Runtime

| Field | Value |
|---|---|
| Jac version | 0.13.5 (reported by `jac --version`; toolchain labels itself as compatible with 0.37 API surface) |
| Python | 3.14.3 |
| Platform | Windows AMD64 |
| Test count (this tree) | 17 tests across 5 test-bearing files |
| Test run time | ~0.37s |

## 0.1 Walkers
There are 10 walkers in `jac/walkers`:
1. `act.jac` - Act
2. `auditor.jac` - Auditor
3. `counsel.jac` - Counsel
4. `cover.jac` - Cover
5. `demo_control.jac` - DemoControl
6. `freshness.jac` - Freshness
7. `get_asset.jac` - GetAsset
8. `get_stamps.jac` - GetStamps
9. `ingest.jac` - Ingest
10. `seed_asset.jac` - SeedAsset

## 0.2 Node Types
There are 7 node types defined in `jac/schemas/nodes.jac`:
1. `Asset`
2. `PriceObservation`
3. `ReserveAttestation`
4. `ChildClaim`
5. `Liability`
6. `Stamp`
7. `MintRecord`

## 0.3 Edge Types
There are 6 edge types defined in `jac/schemas/edges.jac`:
1. `HasPrice`
2. `HasReserve`
3. `DependsOn`
4. `HasLiability`
5. `StampedBy`
6. `MintedAs`

## 0.4 Existing Tests
There are **17 tests across 5 test-bearing files** in `jac/tests`:

| File | Tests |
|---|---|
| `act_tests.jac` | 6 |
| `auditor_tests.jac` | 1 |
| `cover_tests.jac` | 2 |
| `freshness_tests.jac` | 2 |
| `paths_tests.jac` | 6 |
| **Total** | **17** |

`spy_bridge.jac` is also present in the directory but is a **helper module, not a test file**
(it carries no tests) - which is why six `.jac` files hold five files' worth of tests.

All 17 execute and pass: `jac test -d jac/tests` → `17 passed`.

## 0.5 Walker Report Shapes

Verified against the live server (the response envelope is
`{ "ok": bool, "data": { "reports": [ … ] } }`; the shapes below are the report objects):

- `Freshness`: `{ "walker": "Freshness", "color": str, "reasons": list[str] }`
- `Cover`: `{ "walker": "Cover", "color": str, "reasons": list[str], "justified_amount": float, "coverage_ratio": float }`
- `Auditor`: `{ "walker": "Auditor", "color": str, "reasons": list[str] }`
- `Counsel`: `{ "spoken": bool, "narration": str, "missing": list[str] }`
- `Act`: `{ "minted": bool, "amount": float, "justified": float, "tx": str, "nft_id": int, "reason": str }`
  - on refusal `minted: false` and `reason` carries the cause
- `Ingest`: `{ "asset_id": str, "price_source": str, "reserve_source": str }` -
  inputs are `use_fixture: bool`, `fixture_name: str` (the child fixture is derived as
  `child_<stem>`, where `stem` is the last `_`-separated segment), `child_present: bool`,
  and the live-feed overrides `price_feed_address` / `reserve_feed_address` / `child_asset_id`
- `SeedAsset`: `{ "asset_id": str, "created": bool, "node_id": str }`
  - note `created`, **not** `existing`; `created: false` means the asset was already seeded
- `GetAsset`: the **flat asset object** -
  `{ "id", "node_id", "name", "symbol", "chain", "token_address", "created_at", "overall_status", "edges": list }`
  - there is **no `nodes` key**; the frontend derives nodes from the edge targets, which are
  inlined in the `edges` array. `ReserveAttestation` targets now include `flat_history: list[float]`
  for caution-verdict evidence display.

## 0.6 Cover Justified Amount Formula
```jac
coverage_value = reserve.amount * price.value;
liability_value = (liab.minted_units + liab.demo_position) * price.value;
ratio = coverage_value / liability_value if liability_value > 0.0 else 0.0;
max_mintable = (coverage_value / price.value) - liab.minted_units - liab.demo_position;
justified_amount = max(0.0, max_mintable);
```

## 0.7 Act Mint Rule
```jac
if sum([1 for stamp in stamps if stamp.color == "green"]) == 3 {
    let mint_amount = min(requested_amount, max_justified);
    # ... executes mint ...
}
```

## 0.8 Frontend Endpoints
- Base URL: `http://localhost:8000` (or `NEXT_PUBLIC_API_URL`)
- Path template: `/walker/{WalkerName}/{node_id}`
- Envelope shape: `{ ok: boolean, data: { reports: [...] } }`

## 0.9 Required Environment Variables
- `POR_TOKEN_ADDRESS`
- `POR_ATTESTATION_ADDRESS`
- `SEPOLIA_RPC_URL`
- `DEPLOYER_PRIVATE_KEY`
- `DEMO_RECIPIENT` (CLI path; UI path uses hardcoded 0x748ABdeF0775132E8F941e1513152D5eb02D3a4B)
- (Optional) `PRICE_FEED_ADDRESS`, `RESERVE_FEED_ADDRESS`

## 0.10 /healthz
Endpoint returns `{"status": "ok"}` when the Jac runtime is fully booted.

## 0.11 Trace Instrumentation
All five approval walkers (Freshness, Cover, Auditor, Counsel, Act) emit gated `[TRACE]`
lines when `PORJE_TRACE=1`. The flag is read once at module load from `jac/lib/utils.jac`:
```jac
glob PORJE_TRACE: bool = os.environ.get("PORJE_TRACE", "0") == "1";
```
Set `PORJE_TRACE=0` (or omit it) for silent runs.
