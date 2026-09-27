# PoRJE Audit Prompt 3

Copy the block below and feed it to a Senior Engineering evaluator to perform a comprehensive audit of the PoRJE codebase.

```text
TASK: Perform a comprehensive audit of the Proof of Reserve Jac Enforced (PoRJE) architecture, evaluating its execution invariants, fail-closed mechanics, and orchestration logic.

OVERVIEW:
PoRJE ensures a minting operation can only execute if the required reserve is cryptographically proven, fresh, fully funded, and independently audited.

The project blends Python for environment verification and UI delivery, with Jac for the primary graph-based logic and validation walkers. Recent changes transitioned core orchestration into Jac walkers (DemoOrchestrator and HealthCheck) to centralize rules and achieve >40% Jac codebase ratio.

EVALUATE THE FOLLOWING INVARIANTS:

1. Fail-Closed Live Feeds (Ingest Guard):
   Examine `jac/walkers/ingest.jac` and `scripts/verify_por_feeds.py`.
   - Does `Ingest` explicitly halt and return an error report if either `PRICE_FEED_ADDRESS` or `RESERVE_FEED_ADDRESS` are empty when `use_fixture=False`?
   - Do the negative tests correctly trigger this guard, confirming no data is written to the graph?

2. Orchestration Consolidation:
   Examine `jac/walkers/demo_orchestrator.jac` and `jac/walkers/health_check.jac`.
   - Has the Python orchestration (`scripts/seed_graph.py`, `scripts/run_demo_path.py`) been successfully transitioned to `DemoOrchestrator`?
   - Does `DemoOrchestrator` correctly sequence `SeedAsset`, `DemoControl`, `GetAsset`, `Act`, and `Counsel`?
   - Does `HealthCheck` correctly calculate graph dimensions (node and edge counts) natively instead of relying on Python iteration?

3. Test Coverage:
   Examine `jac/tests/ingest_tests.jac`, `jac/tests/get_asset_tests.jac`, and `jac/tests/counsel_tests.jac`.
   - Are the negative cases explicitly defined?
   - Does `get_asset_tests.jac` prove flat-history returns correct invariants?

4. Documentation & Reset:
   Examine `demo.md` and `scripts/reset.py`.
   - Does the demo instructions accurately guide users through a cross-platform reset utilizing `scripts/reset.py`?
   - Is `reset.py` capable of terminating stale instances and dropping local `.jac` dependencies reliably?

REQUIRED OUTPUT:
1. Provide a PASS/FAIL for each invariant.
2. Detail any deviations from the fail-closed expectation.
3. Suggest the next architectural evolution for graph state persistence if the `.jac` directory proves unstable under high load.
```

## How to get Real Feed Addresses

To run the live mode effectively, you must configure valid Chainlink Data Feeds on Sepolia.
Go to the Chainlink documentation at `https://docs.chain.link/data-feeds/price-feeds/addresses?network=ethereum&page=1` and locate Sepolia testnet feeds.

For testing, we use the following verified feeds on Sepolia:

- **PRICE_FEED_ADDRESS** (BTC/USD): `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43`
- **RESERVE_FEED_ADDRESS** (PoR Address): `0x694AA1769357215DE4FAC081bf1f309aDC325306`

Update your `.env` file accordingly before running `scripts/verify_por_feeds.py` or the live demo path.
