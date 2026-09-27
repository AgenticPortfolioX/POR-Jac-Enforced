# Walkers — Proof of Reserve, Jac Enforced

Ten walkers, each with exactly one authority. Nine of them are declared `with Asset entry`, which means they run **only** when spawned on the asset node:

```
POST /walker/{Name}/{node_id}
```

`SeedAsset` is the exception — its entry is `Root`, so it is the only walker reachable at `POST /walker/SeedAsset`, and the only way to discover the `node_id` every other walker needs. Spawning an `Asset`-entry walker on root runs nothing and reports nothing.

---

## Ingest

- **Purpose.** Load the price observation, the reserve attestation, the child claim, and the liability onto the graph — from Chainlink feeds when live, from labeled fixtures for the demo.
- **Inputs.** `price_feed_address`, `reserve_feed_address`, `child_asset_id` (default `"USDC"`), `use_fixture` (default `True`), `fixture_name` (default `"por_live"`), `child_present` (default `True`). The fixture stem is derived from the name (`por_live` → `live`), which selects `price_{stem}`, `child_{stem}`, and the named reserve fixture.
- **`child_present`.** ANDs into the child claim's `present` flag, so `Ingest(..., child_present=False)` marks the backing layer absent in one call. This exists so the `unknown` demo path is a single `Ingest` rather than an ingest plus a follow-up traversal that reaches into the reserve and flips the child — which is what lets the UI walk the path as four uniform steps (see `DemoControl`).
- **Writes.** **Upserts** `PriceObservation`, `ReserveAttestation`, `ChildClaim`, and `Liability` in place: it attaches a node only when none exists, otherwise it mutates the existing node's fields, so a re-ingest refreshes the facts and exactly one observation of each type survives any number of runs. Edges are `HasPrice`, `HasReserve`, `HasLiability` from the Asset and `DependsOn` from reserve to child. It must **not** delete-then-recreate — `Ingest` runs as a spawned sibling, and a sibling's `del [edge …]` is silently lost under 0.37 commit semantics, which is what let observations accumulate one per run. See **Spawned-sibling commit semantics** in `docs/architecture.md`.
- **`flat_history`.** Carried onto the reserve node when the fixture supplies it, and **cleared to `[]` when it does not**. The clear is load-bearing rather than defensive: the reserve node now persists across runs, so a `por_flat` ingest followed by a `por_live` one would otherwise leave the flat windows attached and `Cover` would keep reading yellow on a healthy reserve. Only `por_flat.json` carries the key.
- **Forbidden.** Minting, stamping, EVM calls, and inventing a fixture that does not exist. There is no `price_flat.json` (the fixture set is fixed at seven files), so the yellow path loads `por_flat` with `price_live` — the scenario is "flat reserve **while price moved**" and the price must come from somewhere. A missing `child_{stem}` fixture falls back to an inline present child rather than crashing.
- **Report shape.**
  ```json
  {"asset_id": "asset-1", "price_source": "fixture", "reserve_source": "fixture"}
  ```
  Errors report `{"error": "feed_addresses_missing"}` or `{"error": "feed_unavailable"}` when live mode is requested without usable feeds.

---

## Freshness

- **Purpose.** Decide whether the two observations are still facts about *now*.
- **Inputs.** `HasPrice` and `HasReserve` edges; `POLICY["max_price_age_seconds"]`, `POLICY["max_reserve_age_seconds"]`.
- **Writes.** One `Stamp` node (`walker_name="Freshness"`) linked by a `StampedBy` edge, after deleting any prior Freshness stamp. The stamp carries `payload={}` — Freshness publishes a verdict, not a number.
- **Forbidden.** Minting, reading the liability, reading the child claim, and judging coverage. It looks at clocks only. It also may not treat absence as a pass: no price or no reserve yields `unknown`.
- **Report shape.**
  ```json
  {"walker": "Freshness", "color": "green",
   "reasons": ["price age 12s <= max 300s", "reserve age 30s <= max 3600s", "source is fixture (labeled)"]}
  ```
  Reserve age above half of `max_reserve_age_seconds` is yellow; above the max is red. A fixture source appends `"source is fixture (labeled)"` so provenance is visible in the reasons.

---

## Cover

- **Purpose.** Compute what the reserve actually covers, and how much may therefore be printed.
- **Inputs.** `HasPrice`, `HasReserve`, `HasLiability` edges; `DependsOn` child; `flat_history` on the reserve; `min_coverage_ratio`, `coverage_floor_ratio`, `flat_reserve_epsilon`, `flat_reserve_windows`, `child_max_age_seconds`.
- **Writes.** One `Stamp` node (`walker_name="Cover"`) via `StampedBy`, replacing any prior Cover stamp. **Its payload is the interface the rest of the system depends on**: `{"justified_amount": float, "coverage_ratio": float}`. `Act` reads `justified_amount` to size the mint; `Counsel` reads both to narrate.
- **Forbidden.** Minting, and deciding freshness — it consumes the price and reserve values but does not re-judge their ages. It may not treat missing inputs as covered: no price, reserve, or liability yields `unknown`.
- **Report shape.**
  ```json
  {"walker": "Cover", "color": "green",
   "reasons": ["child attestation: present",
               "coverage ratio 1.25 >= min 1.0",
               "justified amount: 250000.0"],
   "justified_amount": 250000.0, "coverage_ratio": 1.25}
  ```
  Verdicts: a missing or stale child is **red**; a flat reserve series is **yellow** (`"flat reserve while price moved (punctual but no pulse)"`); ratio below `coverage_floor_ratio` is **red**, below `min_coverage_ratio` is **yellow**. `justified = coverage_value/price − minted_units − demo_position`, floored at `0.0`.

---

## Auditor

- **Purpose.** Attack the claim independently and leave a full record — including when it passes.
- **Inputs.** `HasPrice`, `HasReserve`, `HasLiability`, `DependsOn` child, `flat_history`; `max_price_age_seconds`, `min_coverage_ratio`, `coverage_floor_ratio`, `flat_reserve_epsilon`, `flat_reserve_windows`, `child_max_age_seconds`.
- **Writes.** One `Stamp` node (`walker_name="Auditor"`) via `StampedBy`, replacing any prior Auditor stamp. Its `reasons` are always the **four** findings — `age skew`, `flat reserve`, `child attestation`, `liability cover` — each with its own verdict word, even on green. `payload={}`.
- **Forbidden.** Minting **and narrating**. The Auditor writes findings to the graph and stops; it never produces prose for a human. It also may not silently pass on missing data: with no price or reserve it writes all four findings as `— unknown`.
- **Report shape.**
  ```json
  {"walker": "Auditor", "color": "green",
   "reasons": ["age skew — none",
               "flat reserve — none",
               "child attestation — present",
               "liability cover — holds"]}
  ```
  Note the difference from Cover: Cover's flat-reserve check is guarded by `reserve.amount > 0` and does not overwrite an existing reason, while the Auditor always emits a flat-reserve line. The Auditor is deliberately the noisier of the two — its job is visibility, not economy.

---

## Act

- **Purpose.** The only walker permitted to mint. It converts three green stamps into a sized, recorded transfer.
- **Inputs.** All `StampedBy` stamps on the asset; `Cover.payload["justified_amount"]`; `requested_amount`, `recipient`, `token_address`, `attestation_address`. Price and reserve timestamps for the record.
- **Writes.** On success only: calls `evm_py.mint(token, recipient, amount, reason_json)` and `evm_py.mint_attestation(attestation, recipient, amount, justified, price_time, reserve_time, stamp_summary)`, then writes a `MintRecord` node via a `MintedAs` edge and sets `asset.overall_status = "minted"`.
- **Forbidden.** Everything that is not minting. It has no opinion about freshness, coverage, or children — it reads only the stamps and the Cover payload. It may not mint when any of the three stamps is missing or non-green, and it may not mint more than `min(requested, justified)`. On refusal it writes **nothing**: no MintRecord, no status change.
- **Report shape.** Refusals:
  ```json
  {"minted": false, "reason": "Cover stamp is yellow"}
  {"minted": false, "reason": "Freshness stamp missing"}
  {"minted": false, "reason": "justified amount is zero"}
  ```
  Success:
  ```json
  {"minted": true, "amount": 250000.0, "justified": 250000.0, "tx": "0x…", "nft_id": 1}
  ```
  `amount` is the minted quantity and `justified` the ceiling that permitted it — they differ whenever the caller asked for more than coverage allows. That difference is the product.

---

## Counsel

- **Purpose.** Explain what the graph decided, in words, after the fact.
- **Inputs.** The `Stamp` nodes only — Freshness, Cover, and Auditor, with their colors, reasons, and Cover's payload.
- **Writes.** Nothing. Counsel is read-only on the graph; narration goes into its report.
- **Forbidden.** Speaking before the verdicts exist. If any of the three stamps is missing it returns `{"spoken": false, ...}` and stops. It may not compute coverage, re-judge freshness, or speculate about a decision that was never written — it has no access to prices, reserves, or liabilities.
- **Report shape.**
  ```json
  {"spoken": false, "reason": "stamps incomplete", "missing": ["Cover", "Auditor"]}
  ```
  ```json
  {"spoken": true, "narration": "Freshness green: price age 12s <= max 300s, … . Cover green: coverage ratio 1.25, justified 250000.0. Auditor green: … . The mint was justified for 250000.0 units."}
  ```
  When the stamps are not all green the closing line becomes: *"No mint was justified. A PoR page might still show a number; this printer will not treat that number as a permit."*

---

## DemoControl

- **Purpose.** Drive one of the three demo paths in a single call: seed fixtures, then run the three approval walkers.
- **Inputs.** `path` — one of `"happy"`, `"yellow"`, `"unknown"`.
- **Writes.** Delegates all writes to the walkers it spawns: `Ingest`, then `Freshness`, `Cover`, `Auditor`. For `unknown` it passes `child_present=False` to `Ingest`, which marks the child claim absent, simulating a missing backing layer.
- **Not used by the UI.** It runs all four walkers inside one frame, which is right for the CLI and the tests and invisible on screen. The frontend instead sends the four walkers as separate requests so the traversal can be watched; `test_stepwise_walk_matches_demo_control` asserts the two routes agree.
- **Forbidden.** Minting and narrating. DemoControl spawns only the four walkers above — **never Act, never Counsel**. The demo operator clicks the printer separately, on purpose, so the refusal is a visible act rather than a side effect of seeding.
- **Report shape.**
  ```json
  {"path": "happy", "status": "walkers_run"}
  ```
  An unrecognised path reports `{"error": "unknown path …"}` and returns without seeding.

---

## SeedAsset

- **Purpose.** Create the root Asset node if it does not exist. Idempotent, and the entry point for every other walker.
- **Inputs.** `id` (default `"asset-1"`), `name`, `symbol`, `chain`, `token_address`, `created_at`.
- **Writes.** One `Asset` node linked from root, when absent. On a repeat call it writes nothing and reports the existing node.
- **Forbidden.** Creating a second Asset with the same `id`, and any EVM or stamping activity.
- **Report shape.** This walker is the only source of the graph node id:
  ```json
  {"asset_id": "asset-1", "node_id": "f025caf0c2b842ccb88898300f6fc7a4", "created": true}
  ```
  `created` is `false` on an idempotent re-run. `node_id` comes from the Jac builtin `jid(node)`; callers must use it as the path parameter for every other walker.

---

## GetAsset

- **Purpose.** Read-only dump of the whole claim graph under one asset, shaped for the frontend's React Flow mapping.
- **Inputs.** `asset_id` (accepted for compatibility; the graph is reached from the entry node).
- **Writes.** Nothing.
- **Forbidden.** All writes, and all judgement. It reports what is on the graph and nothing else.
- **Report shape.** A single object with the asset fields plus an `edges` array. Each edge carries `type` and a `target` object tagged with `nodeType` (`PriceObservation`, `ReserveAttestation`, `ChildClaim`, `Liability`, `Stamp`, `MintRecord`); `DependsOn` also carries a `source` so the frontend can hang the child under the reserve rather than under the asset. Stamp targets include `walker_name`, `color`, `reasons`, and `payload`; MintRecord targets include `tx_hash`, `nft_token_id`, `minted_amount`, `coverage_used`, and `stamp_summary`.

---

## GetStamps

- **Purpose.** Read-only list of just the stamps on an asset — the quickest way to check a verdict without pulling the whole graph.
- **Inputs.** None beyond the entry node.
- **Writes.** Nothing.
- **Forbidden.** All writes.
- **Report shape.**
  ```json
  {"stamps": [{"walker_name": "Cover", "color": "green", "reasons": ["…"], "timestamp": 1758900000, "payload": {"justified_amount": 250000.0, "coverage_ratio": 1.25}}]}
  ```
